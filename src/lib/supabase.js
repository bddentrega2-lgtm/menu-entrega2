import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xucbysdvipebywdptvfw.supabase.co";

const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1Y2J5c2R2aXBlYnl3ZHB0dmZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzkyMjgsImV4cCI6MjA5NDUxNTIyOH0.6N5swdGxmZ4fzbR4KzutSCDu6SWbNhoVFiGJis9XsB4";

export const supabase = createClient(supabaseUrl, supabaseKey);