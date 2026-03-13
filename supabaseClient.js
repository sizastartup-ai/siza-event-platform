const { createClient } = require('@supabase/supabase-js');

// This tells the app to look for the variable name, NOT the actual URL
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;