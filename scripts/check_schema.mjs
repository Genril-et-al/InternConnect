import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envStr = fs.readFileSync('.env.local', 'utf8')
const supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.+)/)[1]
const supabaseKey = envStr.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1]

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  // To get columns, we can try to select one row
  const { data, error } = await supabase.from('applications').select('*').limit(1)
  if (error) {
    console.error('Error fetching applications:', error)
  } else {
    console.log('Applications columns (from first row):', Object.keys(data[0] || {}))
  }
}

run()
