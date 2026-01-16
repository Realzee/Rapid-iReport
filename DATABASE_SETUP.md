# RAPID iREPORT - Supabase Database Setup

If you encounter errors like "Could not find column 'location_boundary'", "violates row-level security policy", or "Error setting up presence", your Supabase database schema is out of sync with the application code.

To fix all known database issues, please follow these steps carefully. This script is safe to run multiple times.

## Step 1A: Create the 'evidence' Storage Bucket

This is for incident-related images. If you've already done this, you can skip to Step 1B.

1.  Navigate to your Supabase Project dashboard.
2.  In the left sidebar, go to **Storage**.
3.  Click the **+ New Bucket** button.
4.  Enter the bucket name exactly as `evidence`.
5.  Toggle the **Public bucket** switch to ON.
6.  Click **Create Bucket**.

## Step 1B: Create the 'avatars' Storage Bucket

This is for user profile pictures.

1.  While in the **Storage** section, click **+ New Bucket** again.
2.  Enter the bucket name exactly as `avatars`.
3.  Toggle the **Public bucket** switch to ON.
4.  Click **Create Bucket**.


## Step 2: Run the Complete Database Setup Script

This comprehensive script creates all necessary types, tables, functions, and security policies. It is designed to be **idempotent**, meaning you can run it on a new project or an existing one without causing errors. It will only add the pieces that are missing.

1.  Open the `DATABASE_SCHEMA.md` file located in the root of this project.
2.  Copy the entire SQL code block from the file.
3.  In your Supabase Project dashboard, go to the **SQL Editor**.
4.  Click **+ New query**.
5.  Paste the script into the editor and click the **RUN** button.

## Step 3: Deploy Supabase Edge Functions

These server-side functions are required for secure administrative actions. Follow these steps to deploy all required functions.

1.  **Install Supabase CLI:** If you haven't already, [install the Supabase CLI](https://supabase.com/docs/guides/cli/getting-started).

2.  **Link your project:** In your computer's terminal, navigate to your project folder and run `supabase login`, then `supabase link --project-ref <your-project-ref>`. Your `<project-ref>` is in your Supabase project's URL (`<project-ref>.supabase.co`).

3.  **Deploy `update-user-password` Function:**
    *   Create the function: `supabase functions new update-user-password`.
    *   Open the new file `supabase/functions/update-user-password/index.ts` and replace its content with the code below.
    ```typescript
    import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    serve(async (req) => {
      if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
      try {
        const { userId, password } = await req.json()
        if (!userId || !password) throw new Error("A userId and new password must be provided.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters long.");
        
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: password })
        if (error) throw error
        
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
      }
    })
    ```
    *   Deploy it: `supabase functions deploy update-user-password --no-verify-jwt`.

4.  **Deploy `approve-request` Function:**
    *   Create the function: `supabase functions new approve-request`.
    *   Open `supabase/functions/approve-request/index.ts` and replace its content with this code:
    ```typescript
    import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    serve(async (req) => {
        if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
        try {
            const { requestId } = await req.json()
            if (!requestId) throw new Error("Request ID is required.");

            const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

            // 1. Fetch the registration request
            const { data: request, error: requestError } = await supabaseAdmin
                .from('registration_requests')
                .select('*')
                .eq('id', requestId)
                .single();
            if (requestError || !request) throw new Error("Registration request not found or failed to fetch.");
            if (request.status !== 'pending') throw new Error("This request has already been processed.");

            // 2. Handle company creation/lookup
            let companyId = null;
            if (request.company_name) {
                const { data: existingCompany } = await supabaseAdmin.from('companies').select('id').eq('name', request.company_name).single();
                if (existingCompany) {
                    companyId = existingCompany.id;
                } else {
                    const { data: newCompany, error: companyError } = await supabaseAdmin.from('companies').insert({ name: request.company_name }).select('id').single();
                    if (companyError) throw new Error(`Failed to create company: ${companyError.message}`);
                    companyId = newCompany.id;
                }
            }

            // 3. Invite the user
            const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(request.email, {
                data: {
                    full_name: request.full_name,
                    role: request.requested_role,
                }
            });
            if (inviteError) throw new Error(`Failed to invite user: ${inviteError.message}`);
            
            // 4. Update the profile with company and status once user is created.
            // Note: The handle_new_user trigger creates the basic profile.
            // We need to update it post-creation.
            if (inviteData.user) {
                const { error: profileUpdateError } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        company_id: companyId,
                        status: 'active'
                    })
                    .eq('id', inviteData.user.id);

                if (profileUpdateError) {
                    // This is a non-fatal error, the main goal was achieved. Log it.
                    console.warn(`User invited, but failed to update profile for ${inviteData.user.id}: ${profileUpdateError.message}`);
                }
            }

            // 5. Update the request status to 'approved'
            const { error: updateRequestError } = await supabaseAdmin
                .from('registration_requests')
                .update({ status: 'approved' })
                .eq('id', requestId);
            if (updateRequestError) throw new Error(`User invited, but failed to update request status: ${updateRequestError.message}`);

            return new Response(JSON.stringify({ message: "User approved and invited successfully." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });

        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }
    })
    ```
    *   Deploy it: `supabase functions deploy approve-request --no-verify-jwt`.

5.  **Deploy `create-user` Function:**
    *   Create the function: `supabase functions new create-user`.
    *   Open `supabase/functions/create-user/index.ts` and replace its content with this code:
    ```typescript
    import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    serve(async (req) => {
      if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
      try {
        const { email, password, fullName, role } = await req.json()

        if (!email || !password || !fullName || !role) {
          throw new Error('Email, password, full name, and role are required.')
        }
        if (password.length < 6) {
            throw new Error("Password must be at least 6 characters long.");
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            role: role
          }
        })

        if (error) throw error

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
    })
    ```
    *   Deploy it: `supabase functions deploy create-user --no-verify-jwt`.
    
6.  **Deploy `delete-user` Function:**
    *   Create the function: `supabase functions new delete-user`.
    *   Open `supabase/functions/delete-user/index.ts` and replace its content with this code:
    ```typescript
    import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    serve(async (req) => {
      if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
      try {
        const { userId } = await req.json()
        if (!userId) throw new Error('A userId must be provided.')

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (error) throw error

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
    })
    ```
    *   Deploy it: `supabase functions deploy delete-user --no-verify-jwt`.

This completes the setup for all application features. Your application should now function correctly.