// npm install --no-save --package-lock=false @electric-sql/pglite
// node tests/product-reactions-db.cjs
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function createReactionDB() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create table public.products (id bigint primary key); insert into public.products values (901), (902);');
  const sql = fs.readFileSync(path.join(__dirname, '../database/product-reactions.sql'), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // Setup is safe to re-run.
  await db.exec('set role anon');
  return db;
}

async function run() {
  const db = await createReactionDB();
  const first = randomUUID(), second = randomUUID();
  const read = (token = null) => db.query('select * from public.get_product_reactions($1::bigint[], $2::uuid)', [[901, 902], token]);
  const write = (reaction, token = first, id = 901) => db.query('select * from public.set_product_reaction($1::bigint, $2::text, $3::uuid)', [id, reaction, token]);
  try {
    let row = (await read()).rows[0];
    assert.equal(Number(row.like_count), 0);
    assert.equal(Number(row.love_count), 0);
    assert.equal(Number(row.wow_count), 0);
    assert.equal(row.my_reaction, null);
    await write('like');
    await write('like');
    await write('love', second);
    row = (await read(first)).rows.find(r => r.product_id == 901);
    assert.equal(Number(row.like_count), 1, 'Repeated writes do not inflate counts');
    assert.equal(Number(row.love_count), 1, 'Other visitors contribute shared totals');
    assert.equal(row.my_reaction, 'like');
    assert.equal((await read()).rows[0].my_reaction, null, 'Public reads do not expose personal choices');
    row = (await write('wow')).rows[0];
    assert.equal(Number(row.like_count), 0);
    assert.equal(Number(row.wow_count), 1);
    await write(null);
    await write(null);
    row = (await read()).rows[0];
    assert.equal(Number(row.wow_count), 0);
    assert.equal(Number(row.love_count), 1, 'Removing one visitor does not remove another');
    console.log('PASS SQL independent counts, two visitors, idempotency, switch/remove, anonymous reads');

    await assert.rejects(write('invalid'), /Invalid reaction/);
    await assert.rejects(write('like', null), /visitor token/);
    await assert.rejects(write('like', first, 999999), /Product not found/);
    await assert.rejects(db.query('select * from public.get_product_reactions($1::bigint[], null)', [Array(101).fill(901)]), /at most 100/);
    await assert.rejects(db.query('select * from gogo_private.product_reactions'), /permission denied/);
    await assert.rejects(db.query("update gogo_private.product_reactions set reaction = 'wow'"), /permission denied/);
    await assert.rejects(db.query('delete from gogo_private.product_reactions'), /permission denied/);
    await db.exec('reset role');
    const security = await db.query("select relrowsecurity from pg_class where oid = 'gogo_private.product_reactions'::regclass");
    assert.equal(security.rows[0].relrowsecurity, true);
    const publicFunctions = await db.query("select prosecdef from pg_proc where oid in ('public.get_product_reactions(bigint[],uuid)'::regprocedure, 'public.set_product_reaction(bigint,text,uuid)'::regprocedure)");
    assert(publicFunctions.rows.every(row => row.prosecdef === false));
    await db.exec('delete from public.products where id = 901');
    assert.equal((await db.query('select count(*) from gogo_private.product_reactions')).rows[0].count, 0);
    console.log('PASS SQL input validation, direct read/write denial, RLS, invoker wrappers and product-delete cleanup');
  } finally { await db.close(); }
}

module.exports = { createReactionDB };
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
