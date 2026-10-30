const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
let rows = []; let failure = null;
const sb = {from: () => ({select: () => ({order: async () => ({data: rows, error: failure})})})};
const context = {window: {supabase: {createClient: () => sb}}, localStorage: {}, console};
vm.createContext(context); vm.runInContext(fs.readFileSync('supabase-config.js','utf8'),context);
(async () => {
 const load = () => context.loadStoreCategories();
 rows = [{name:'Gifts',slug:'gifts'},{name:'SYSTEM',slug:'system_popular_categories',image_url:JSON.stringify([{name:'Deleted',slug:'deleted'}])}];
 assert.equal((await load()).length,1);
 rows[0].name='New name'; assert.equal((await load())[0].name,'New name');
 rows.push({name:'Food',slug:'food'}); assert.equal((await load()).length,2);
 rows.splice(0,1); assert.equal((await load())[0].slug,'food');
 rows.splice(1,1); assert.equal((await load()).length,0);
 failure = new Error('Denied'); await assert.rejects(load,/Denied/);
 for (const file of fs.readdirSync('.').filter(f=>f.endsWith('.html'))) {
  for (const [,attrs,script] of fs.readFileSync(file,'utf8').matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
   if (!attrs.includes('src=') && !attrs.includes('application/')) new vm.Script(script,{filename:file});
  }
 }
 console.log('PASS: category add/rename/delete/empty/error and inline JavaScript syntax');
})();
