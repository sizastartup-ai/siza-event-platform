const { createClient } = require('@supabase/supabase-js');

// Using process.env to fetch the variables from the Railway dashboard
const supabaseUrl = process.env.https://lzryobzkamunzemtsvtc.supabase.co;
const supabaseKey = process.env.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cnlvYnprYW11bnplbXRzdnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3OTE5NjIsImV4cCI6MjA4ODM2Nzk2Mn0.6mSv3WqXdz7k5D94sAxqd2Vg1O9kQrGLUWsvL - bSh8I;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;