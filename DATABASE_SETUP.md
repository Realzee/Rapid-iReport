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

1.  Open the `DATABASE_SCHEMA.sql` file located in the root of this project.
2.  Copy the entire content of the file.
3.  In your Supabase Project dashboard, go to the **SQL Editor**.
4.  Click **+ New query**.
5.  Paste the script into the editor and click the **RUN** button.

## Step 3: Deploy 'update-user-password' Edge Function (Required for Admins)

The **Users** admin page has a feature for admins to update a user's password. This requires a Supabase Edge Function for security reasons. Without it, you can still update user profiles, but not their passwords from the admin dashboard.

1.  **Install Supabase CLI:** If you haven't already, [install the Supabase CLI](https://supabase.com/docs/guides/cli/getting-started).

2.  **Link your project:** In your computer's terminal, navigate to your project folder and run `supabase login`, then `supabase link --project-ref <your-project-ref>`. Your `<project-ref>` is in your Supabase project's URL (`<project-ref>.supabase.co`).

3.  **Create the function:** Run `supabase functions new update-user-password`. This creates a new folder at `supabase/functions/update-user-password/`.

4.  **Replace the function code:** Open the new file `supabase/functions/update-user-password/index.ts` and replace its entire content with the following code. This code includes necessary CORS headers to allow your app to call it.

    ```typescript
    import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'

    // Define CORS headers for preflight and actual requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    serve(async (req) => {
      // Handle preflight OPTIONS request
      if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
      }

      try {
        const { userId, password } = await req.json()
        if (!userId || !password) {
          throw new Error("A userId and new password must be provided.");
        }
        if (password.length < 6) {
            throw new Error("Password must be at least 6 characters long.");
        }

        // Create a Supabase client with the SERVICE_ROLE_KEY to perform admin actions
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Update the user's password
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password: password }
        )

        if (error) {
          throw error
        }

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

5.  **Deploy the function:** In your terminal, run `supabase functions deploy update-user-password --no-verify-jwt`.

This completes the setup for all application features. After running the SQL script and deploying the function, your application should function correctly without any further schema or permission-related errors.