import type { Request, Response } from 'express';

export default async function publicReportHandler(req: Request, res: Response) {
  const supabaseAdmin = (req as any).supabaseAdmin;

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database service unavailable' });
  }

  // GET: Track a report by OB Number
  if (req.method === 'GET') {
    const obNumber = String(req.query.ob_number || req.query.ob || '').trim();
    if (!obNumber) {
      return res.status(400).json({ error: 'Missing ob_number query parameter' });
    }

    try {
      const [crimeRes, vehicleRes, emergencyRes] = await Promise.all([
        supabaseAdmin
          .from('crime_reports')
          .select('id, ob_number, title, crime_type, status, severity, location, reported_at, company_id, company:companies(name, logo_url)')
          .ilike('ob_number', obNumber)
          .maybeSingle(),
        supabaseAdmin
          .from('vehicle_reports')
          .select('id, ob_number, vehicle_make, vehicle_model, license_plate, status, severity, last_seen_location, reported_at, company_id, company:companies(name, logo_url)')
          .ilike('ob_number', obNumber)
          .maybeSingle(),
        supabaseAdmin
          .from('emergency_reports')
          .select('id, ob_number, emergency_type, status, severity, location, reported_at, company_id, company:companies(name, logo_url)')
          .ilike('ob_number', obNumber)
          .maybeSingle(),
      ]);

      const foundReport = crimeRes.data || vehicleRes.data || emergencyRes.data;

      if (!foundReport) {
        return res.status(404).json({ error: 'Report not found with the provided reference number' });
      }

      // Safe public status mappings
      const statusLabels: Record<string, { label: string; stage: number; description: string }> = {
        active: { label: 'Received & Logged', stage: 1, description: 'Incident logged in the central dispatch security feed.' },
        pending: { label: 'Under Review', stage: 1, description: 'Under review by security dispatch.' },
        stolen: { label: 'Active Lookout / BOLO', stage: 2, description: 'Vehicle broadcasted across response network.' },
        bolo: { label: 'Active Lookout', stage: 2, description: 'Lookout circulated to patrol vehicles.' },
        sought: { label: 'Sought by Responders', stage: 2, description: 'Active search in progress.' },
        assigned: { label: 'Units Assigned', stage: 2, description: 'Response units and security officers dispatched.' },
        en_route: { label: 'Units En Route', stage: 2, description: 'Tactical responders traveling to scene.' },
        on_scene: { label: 'Responders On Scene', stage: 3, description: 'Security / Emergency personnel active on site.' },
        in_progress: { label: 'Investigation In Progress', stage: 3, description: 'Active investigation and operations underway.' },
        resolved: { label: 'Case Resolved / Closed', stage: 4, description: 'Incident has been attended and resolved.' },
        closed: { label: 'Case Closed', stage: 4, description: 'Incident investigation concluded.' },
        recovered: { label: 'Recovered / Secured', stage: 4, description: 'Asset / Location secured successfully.' },
      };

      const currentStatusInfo = statusLabels[foundReport.status] || {
        label: (foundReport.status || 'Active').toUpperCase().replace(/_/g, ' '),
        stage: 2,
        description: 'Report is being processed by security personnel.',
      };

      return res.status(200).json({
        success: true,
        report: {
          id: foundReport.id,
          ob_number: foundReport.ob_number,
          type: foundReport.crime_type || (foundReport.license_plate ? 'Stolen Vehicle / Plate Sighting' : foundReport.emergency_type || 'Incident'),
          title: foundReport.title || foundReport.crime_type || (foundReport.license_plate ? `${foundReport.vehicle_make || ''} ${foundReport.vehicle_model || ''} (${foundReport.license_plate})` : 'Incident Report'),
          status: foundReport.status,
          status_info: currentStatusInfo,
          severity: foundReport.severity,
          location: foundReport.location || (foundReport as any).last_seen_location,
          reported_at: foundReport.reported_at,
          responding_agency: (foundReport.company as any)?.name || 'Rapid Emergency Response Grid',
          agency_logo: (foundReport.company as any)?.logo_url || null,
        }
      });
    } catch (err: any) {
      console.error('Error tracking public report:', err);
      return res.status(500).json({ error: 'Failed to look up report', message: err.message });
    }
  }

  // POST: Submit a new public crime / incident report
  if (req.method === 'POST') {
    try {
      const {
        crime_type,
        incident_category,
        title,
        description,
        severity = 'medium',
        location,
        location_coords,
        date_of_incident,
        evidence_images = [],
        vehicle_involved = false,
        license_plate,
        vehicle_make,
        vehicle_model,
        vehicle_color,
        suspect_details,
        reporter_type = 'anonymous',
        reporter_name,
        reporter_phone,
        reporter_email,
        company_id,
      } = req.body;

      if (!crime_type && !description) {
        return res.status(400).json({ error: 'Please specify the crime type or incident description.' });
      }

      const cleanLocation = (location || '').trim() || 'Unspecified Location';
      const cleanCrimeType = (crime_type || incident_category || 'General Incident').trim();
      const reportTitle = (title || `${cleanCrimeType} in ${cleanLocation.split(',')[0]}`).trim();

      // Process and upload base64 images if provided
      const processedImageUrls: string[] = [];
      if (Array.isArray(evidence_images)) {
        for (let i = 0; i < evidence_images.length; i++) {
          const img = evidence_images[i];
          if (typeof img === 'string') {
            if (img.startsWith('http://') || img.startsWith('https://')) {
              processedImageUrls.push(img);
            } else if (img.startsWith('data:image')) {
              // Extract base64 and upload to Supabase Storage
              try {
                const match = img.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
                if (match) {
                  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
                  const buffer = Buffer.from(match[2], 'base64');
                  const fileName = `public-reports/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
                  
                  const { error: uploadError } = await supabaseAdmin.storage
                    .from('evidence')
                    .upload(fileName, buffer, {
                      contentType: `image/${match[1]}`,
                      upsert: true,
                    });

                  if (!uploadError) {
                    const { data: { publicUrl } } = supabaseAdmin.storage
                      .from('evidence')
                      .getPublicUrl(fileName);
                    processedImageUrls.push(publicUrl);
                  }
                }
              } catch (e) {
                console.warn('Could not upload base64 evidence image:', e);
              }
            }
          }
        }
      }

      // Generate next OB Sequence number
      const now = new Date();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();

      let prefix = 'PUB';
      let targetCompanyId = company_id || null;

      if (targetCompanyId) {
        const { data: comp } = await supabaseAdmin
          .from('companies')
          .select('id, name, alias')
          .eq('id', targetCompanyId)
          .maybeSingle();
        if (comp?.name) {
          prefix = comp.alias || comp.name.charAt(0).toUpperCase();
        }
      }

      // Calculate safe sequence
      let nextSeq = 1;
      try {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { data: countData } = await supabaseAdmin
          .from('crime_reports')
          .select('id', { count: 'exact' })
          .gte('reported_at', startOfMonth);
        nextSeq = (countData?.length || 0) + 1;
      } catch {
        nextSeq = Math.floor(1000 + Math.random() * 9000);
      }

      const paddedSeq = String(nextSeq).padStart(4, '0');
      const generatedObNumber = `${prefix}${paddedSeq}/${month}/${year}`;

      // Build structured reporter meta into description
      const reporterMeta = reporter_type === 'anonymous'
        ? '\n\n🔒 [CONFIDENTIAL PUBLIC SUBMISSION - ANONYMOUS REPORTER]'
        : `\n\n👤 [PUBLIC COMMUNITY REPORTER DETAILS]\nName: ${reporter_name || 'N/A'}\nContact Phone: ${reporter_phone || 'N/A'}\nEmail: ${reporter_email || 'N/A'}`;

      const suspectMeta = suspect_details
        ? `\n\n⚠️ [SUSPECT / PERPETRATOR DETAILS]\n${suspect_details}`
        : '';

      const vehicleMeta = vehicle_involved
        ? `\n\n🚗 [VEHICLE INVOLVED / SIGHTED]\nRegistration Plate: ${license_plate || 'N/A'}\nMake: ${vehicle_make || 'N/A'}\nModel: ${vehicle_model || 'N/A'}\nColor: ${vehicle_color || 'N/A'}`
        : '';

      const finalDescription = `${(description || '').trim()}${reporterMeta}${suspectMeta}${vehicleMeta}`;

      // Determine appropriate table
      const isVehicleStolen = cleanCrimeType.toLowerCase().includes('stolen vehicle') || cleanCrimeType.toLowerCase().includes('carjacking') || cleanCrimeType.toLowerCase().includes('hijacking');
      const isMedicalOrFire = cleanCrimeType.toLowerCase().includes('medical') || cleanCrimeType.toLowerCase().includes('fire') || cleanCrimeType.toLowerCase().includes('ambulance');

      let insertedReport: any = null;
      let insertedTable = 'crime_reports';

      if (isVehicleStolen && license_plate) {
        insertedTable = 'vehicle_reports';
        const vehiclePayload = {
          ob_number: generatedObNumber,
          license_plate: license_plate.trim().toUpperCase(),
          vehicle_make: vehicle_make || 'Unspecified',
          vehicle_model: vehicle_model || 'Unspecified',
          vehicle_color: vehicle_color || 'Unspecified',
          status: 'stolen',
          severity: severity || 'high',
          description: finalDescription,
          last_seen_location: cleanLocation,
          location_coords: location_coords || null,
          evidence_images: processedImageUrls,
          reported_at: now.toISOString(),
          date_of_incident: date_of_incident || now.toISOString().split('T')[0],
          company_id: targetCompanyId,
          vehicle_involved: true,
          is_global: true,
        };

        const { data, error } = await supabaseAdmin.from('vehicle_reports').insert(vehiclePayload).select().single();
        if (error) throw error;
        insertedReport = data;
      } else if (isMedicalOrFire) {
        insertedTable = 'emergency_reports';
        const emergencyPayload = {
          ob_number: generatedObNumber,
          emergency_type: cleanCrimeType,
          status: 'active',
          severity: severity === 'critical' ? 'critical' : 'high',
          description: finalDescription,
          location: cleanLocation,
          location_coords: location_coords || null,
          evidence_images: processedImageUrls,
          reported_at: now.toISOString(),
          date_of_incident: date_of_incident || now.toISOString().split('T')[0],
          company_id: targetCompanyId,
          is_global: true,
          injuries_reported: cleanCrimeType.toLowerCase().includes('medical') || cleanCrimeType.toLowerCase().includes('injury'),
        };

        const { data, error } = await supabaseAdmin.from('emergency_reports').insert(emergencyPayload).select().single();
        if (error) throw error;
        insertedReport = data;
      } else {
        // Standard crime report
        const crimePayload = {
          ob_number: generatedObNumber,
          title: reportTitle,
          crime_type: cleanCrimeType,
          status: 'active',
          severity: severity || 'medium',
          description: finalDescription,
          location: cleanLocation,
          location_coords: location_coords || null,
          evidence_images: processedImageUrls,
          reported_at: now.toISOString(),
          date_of_incident: date_of_incident || now.toISOString().split('T')[0],
          company_id: targetCompanyId,
          is_global: true,
          vehicle_involved: !!vehicle_involved,
          license_plate: vehicle_involved ? (license_plate || null) : null,
          vehicle_make: vehicle_involved ? (vehicle_make || null) : null,
          vehicle_model: vehicle_involved ? (vehicle_model || null) : null,
          vehicle_color: vehicle_involved ? (vehicle_color || null) : null,
        };

        const { data, error } = await supabaseAdmin.from('crime_reports').insert(crimePayload).select().single();
        if (error) throw error;
        insertedReport = data;
      }

      // Create broadcast notifications for controllers and admins
      try {
        let recipientQuery = supabaseAdmin
          .from('profiles')
          .select('id, role')
          .in('role', ['admin', 'moderator', 'controller', 'supervisor']);

        if (targetCompanyId) {
          recipientQuery = recipientQuery.eq('company_id', targetCompanyId);
        }

        const { data: recipientUsers } = await recipientQuery.limit(30);

        if (recipientUsers && recipientUsers.length > 0) {
          const notificationsToInsert = recipientUsers.map((u: any) => ({
            recipient_user_id: u.id,
            type: 'new_report',
            title: `🚨 PUBLIC INCIDENT: ${cleanCrimeType}`,
            message: `New public crime report filed for ${cleanLocation}. Reference: ${generatedObNumber}`,
            reference_id: insertedReport.id,
            is_read: false,
          }));

          await supabaseAdmin.from('notifications').insert(notificationsToInsert);
        }
      } catch (notifErr) {
        console.warn('Could not dispatch notifications for public report:', notifErr);
      }

      return res.status(201).json({
        success: true,
        message: 'Incident report has been submitted to the emergency security grid.',
        ob_number: generatedObNumber,
        report_id: insertedReport.id,
        table: insertedTable,
        reported_at: insertedReport.reported_at,
      });

    } catch (err: any) {
      console.error('Error in public report submission:', err);
      return res.status(500).json({
        error: 'Failed to submit incident report',
        message: err.message || 'Unknown database error',
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
