const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://rrrrmbdlwrzsqqgpayxe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJycnJtYmRsd3J6c3FxZ3BheXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODU3MDAsImV4cCI6MjA5NDI2MTcwMH0.WR_sBEPAJA_-g9htyQ5cvVLJZNPar44w45-tngOELd8"
);

module.exports = supabase;