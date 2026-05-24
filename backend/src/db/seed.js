import { supabase } from './supabase.js';

export async function seedDatabase() {
  // Insert test worker
  const { data: worker, error: workerError } = await supabase
    .from('workers')
    .insert({
      name: 'Bob Martinez',
      email: 'bob@test.com',
      phone: '+1-555-0123',
      language: 'en'
    })
    .select()
    .single();

  if (workerError) throw workerError;

  // Insert test worksites
  const { data: worksites, error: worksitesError } = await supabase
    .from('worksites')
    .insert([
      { name: 'Simons Property', address: '123 Main St', client: 'Simons Corp' },
      { name: 'ACME Construction', address: '456 Oak Ave', client: 'ACME Inc' },
      { name: 'Hyatt Hotel', address: '789 5th Ave', client: 'Hyatt' }
    ])
    .select();

  if (worksitesError) throw worksitesError;

  console.log('Database seeded successfully');
  console.log('Worker:', worker);
  console.log('Worksites:', worksites);

  return { worker, worksites };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
