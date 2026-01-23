# Migration Script: Associate All Reports with "Rapid911"

This script will update all existing user profiles to be associated with the company named "Rapid911". Because reports are linked to users, this will effectively associate all existing reports with that company.

## Instructions

Follow these steps in your Supabase SQL Editor to run the migration.

### Step 1: Ensure "Rapid911" Company Exists

First, you need to make sure a company named "Rapid911" exists in your `companies` table.

Run this command. If it returns a row, you can proceed to Step 2.

```sql
SELECT id, name FROM public.companies WHERE name = 'Rapid911';
```

If it does **not** return a row, run the following command to create it before proceeding:

```sql
INSERT INTO public.companies (name) VALUES ('Rapid911');
```

### Step 2: Run the Migration Script

Copy and paste the entire script below into a new query window in the Supabase SQL Editor and click **"Run"**.

```sql
-- Description: This script updates all users to belong to the "Rapid911" company,
-- which retroactively associates all their reports with that company.

DO $$
DECLARE
    rapid911_company_id uuid;
BEGIN
    -- 1. Find the ID for the "Rapid911" company.
    SELECT id INTO rapid911_company_id FROM public.companies WHERE name = 'Rapid911' LIMIT 1;

    -- 2. Check if the company was found.
    IF rapid911_company_id IS NULL THEN
        RAISE EXCEPTION 'Company "Rapid911" not found. Please create it before running this script.';
    ELSE
        -- 3. Update all profiles to belong to this company.
        UPDATE public.profiles
        SET company_id = rapid911_company_id;

        RAISE NOTICE 'All user profiles have been successfully updated to belong to "Rapid911".';
    END IF;
END $$;
```

After running this script, all reports in the system will be correctly associated with the "Rapid911" company.
