# RAPID iREPORT - Supabase Database Setup

> [!WARNING]
> **PLEASE READ FIRST: Fixing Common "Schema Cache" Errors**
>
> If you are experiencing errors like `Could not find the 'location_coords' column... in the schema cache`, it means your Supabase API is out of sync with the database. This is a common issue that is easy to fix.
>
> **The Solution is to force a schema reload:**
>
> 1.  Go to your **Supabase Project Dashboard**.
> 2.  In the left sidebar, go to **API Docs** (the `<>` icon).
> 3.  Select the **`public`** schema.
> 4.  At the top right, click the **"Reload schema"** button.
> 5.  Refresh the application. The error should be gone.
>
> You must perform this action whenever you manually change the database schema using the SQL Editor.

---

## Step 1: Create Storage Buckets

You need to create three public buckets for storing images.

1.  Navigate to your Supabase Project dashboard and go to **Storage** in the left sidebar.
2.  Create the following buckets, ensuring the **"Public bucket"** switch is toggled ON for each:
    *   `evidence` (for incident-related images)
    *   `avatars` (for user profile pictures)
    *   `company-logos` (for company branding)

## Step 2: Run the Complete Database Setup Script

This comprehensive script creates all necessary types, tables, functions, and security policies. It is designed to be **idempotent**, meaning you can run it on a new project or an existing one without causing errors. It will only add the pieces that are missing.

> [!IMPORTANT]
> This script is in **two parts**. You must run each part in a **separate query window** in the Supabase SQL Editor. Running them together in the same window will cause an error.

1.  Open the `DATABASE_SCHEMA.md` file located in the root of this project.
2.  Copy the entire SQL code block from **Part 1**.
3.  In your Supabase Project dashboard, go to the **SQL Editor** and click **+ New query**.
4.  Paste the script for Part 1 and click **RUN**.
5.  After it succeeds, open a **new, separate query window** by clicking **+ New query** again.
6.  Copy the entire SQL code block from **Part 2** from the `DATABASE_SCHEMA.md` file.
7.  Paste it into the new window and click **RUN**.

## Step 3: Add Storage Security Policies (RLS)

After setting up the tables, you must secure your storage buckets with Row Level Security policies. This script is now idempotent, meaning you can run it multiple times without causing errors.

1.  Return to the **SQL Editor** in your Supabase dashboard.
2.  Run the following script to create the necessary policies for all three buckets. This allows public read access while restricting uploads and modifications to authorized users and giving full control to administrators.

```sql
-- Policies for 'avatars' bucket
DROP POLICY IF EXISTS "Allow public read access to avatars" ON storage.objects;
CREATE POLICY "Allow public read access to avatars" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Allow authenticated users to upload their own avatar" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload their own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'avatars' AND owner = auth.uid() );

DROP POLICY IF EXISTS "Allow authenticated users to update their own avatar" ON storage.objects;
CREATE POLICY "Allow authenticated users to update their own avatar" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'avatars' AND owner = auth.uid() );

DROP POLICY IF EXISTS "Allow admins/mods to manage all avatars" ON storage.objects;
CREATE POLICY "Allow admins/mods to manage all avatars" ON storage.objects FOR ALL TO authenticated USING ( bucket_id = 'avatars' AND (SELECT public.get_user_role(auth.uid())) IN ('admin', 'moderator') ) WITH CHECK ( bucket_id = 'avatars' AND (SELECT public.get_user_role(auth.uid())) IN ('admin', 'moderator') );


-- Policies for 'evidence' bucket
DROP POLICY IF EXISTS "Allow public read access to evidence" ON storage.objects;
CREATE POLICY "Allow public read access to evidence" ON storage.objects FOR SELECT USING ( bucket_id = 'evidence' );

DROP POLICY IF EXISTS "Allow authenticated users to upload evidence" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload evidence" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'evidence' );

DROP POLICY IF EXISTS "Allow admins/mods to manage all evidence" ON storage.objects;
CREATE POLICY "Allow admins/mods to manage all evidence" ON storage.objects FOR ALL TO authenticated USING ( bucket_id = 'evidence' AND (SELECT public.get_user_role(auth.uid())) IN ('admin', 'moderator') ) WITH CHECK ( bucket_id = 'evidence' AND (SELECT public.get_user_role(auth.uid())) IN ('admin', 'moderator') );


-- Policies for 'company-logos' bucket
DROP POLICY IF EXISTS "Allow public read access to company logos" ON storage.objects;
CREATE POLICY "Allow public read access to company logos" ON storage.objects FOR SELECT USING ( bucket_id = 'company-logos' );

DROP POLICY IF EXISTS "Allow admins/mods to manage company logos" ON storage.objects;
CREATE POLICY "Allow admins/mods to manage company logos" ON storage.objects FOR ALL TO authenticated USING (
    bucket_id = 'company-logos' AND
    (SELECT public.get_user_role(auth.uid())) IN ('admin', 'moderator')
) WITH CHECK (
    bucket_id = 'company-logos' AND
    (SELECT public.get_user_role(auth.uid())) IN ('admin', 'moderator')
);
```

## Step 4: Deploy Supabase Edge Functions

These server-side functions are required for secure administrative actions. Follow these steps to deploy all required functions.

1.  **Install Supabase CLI:** If you haven't already, [install the Supabase CLI](https://supabase.com/docs/guides/cli/getting-started).

2.  **Link your project:** In your computer's terminal, navigate to your project folder and run `supabase login`, then `supabase link --project-ref <your-project-ref>`. Your `<project-ref>` is in your Supabase project's URL (`<project-ref>.supabase.co`).

3.  **Deploy `reset-password` Function:**
    *   Create the function: `supabase functions new reset-password`.
    *   Open the new file `supabase/functions/reset-password/index.ts` and replace its content with the code below.
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
        // 1. Create a Supabase client with the user's auth token to check their role
        const userSupabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )
        const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("User not found.");

        const { data: profile, error: profileError } = await userSupabaseClient.from('profiles').select('role').eq('id', user.id).single();
        if (profileError) throw profileError;
        if (!['admin', 'moderator'].includes(profile.role)) {
          throw new Error("Unauthorized: You do not have permission to reset passwords.");
        }

        // 2. If authorized, proceed with the main logic using the admin client
        const { userId, password } = await req.json()
        if (!userId || !password) throw new Error("A userId and new password must be provided.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters long.");
        
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: password })
        if (error) throw error
        
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      } catch (error) {
        const status = error.message.startsWith('Unauthorized') ? 401 : 400;
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })
      }
    })
    ```
    *   Deploy it: `supabase functions deploy reset-password --no-verify-jwt`.

4.  **Deploy `create-user` Function:**
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
        // 1. Authorization check: Ensure the caller is an admin or moderator.
        const userSupabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );
        const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("User not found.");
        const { data: profile, error: profileError } = await userSupabaseClient.from('profiles').select('role').eq('id', user.id).single();
        if (profileError) throw profileError;
        if (!['admin', 'moderator'].includes(profile.role)) {
            throw new Error("Unauthorized: You do not have permission to create users.");
        }
        
        // 2. Main logic: Create the user using the admin client.
        const { email, password, user_metadata } = await req.json()
        if (!email || !password || !user_metadata?.full_name) {
          throw new Error('Email, password, and full_name are required.')
        }
        if (password.length < 6) {
            throw new Error("Password must be at least 6 characters long.");
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: user_metadata // This metadata will be read by the `handle_new_user` trigger
        });

        if (authError) {
            throw new Error(`Auth user creation failed: ${authError.message}`);
        }
        
        // The `handle_new_user` trigger will automatically create the profile.
        // We just return the auth user data.
        return new Response(JSON.stringify(authData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      } catch (error) {
        console.error("CREATE-USER-FUNCTION-ERROR:", error.message);
        const status = error.message.startsWith('Unauthorized') ? 401 : 400;
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status,
        })
      }
    })
    ```
    *   Deploy it: `supabase functions deploy create-user --no-verify-jwt`.
    
5.  **Deploy `delete-user` Function:**
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
        // 1. Authorization check
        const userSupabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );
        const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("User not found.");
        const { data: profile, error: profileError } = await userSupabaseClient.from('profiles').select('role').eq('id', user.id).single();
        if (profileError) throw profileError;
        if (!['admin', 'moderator'].includes(profile.role)) {
            throw new Error("Unauthorized: You do not have permission to delete users.");
        }

        // 2. Main logic
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
        const status = error.message.startsWith('Unauthorized') ? 401 : 400;
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status,
        })
      }
    })
    ```
    *   Deploy it: `supabase functions deploy delete-user --no-verify-jwt`.

This completes the setup for all application features. Your application should now function correctly.