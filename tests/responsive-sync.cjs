const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=path.resolve(__dirname,'..');
const products=[{id:901,name:'Premium Gift Box with a long readable product name',price:14900,old_price:16000,stock:10,category_slug:'gifts',image_url:'logo.png',images:[],description:'Test product'}];
let failCategoryDelete=false;
let categories=[{id:1,name:'Gifts',slug:'gifts',image_url:'logo.png'},{id:2,name:'SYSTEM_POPULAR_CATEGORIES',slug:'system_popular_categories',image_url:'[{"name":"Ghost","slug":"ghost"}]'}];
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'text/plain');fs.createReadStream(file).pipe(res)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({baseURL:`http://127.0.0.1:${server.address().port}`});
 await context.addInitScript(product=>{localStorage.setItem('isAdmin','true');localStorage.setItem('rasa-cart',JSON.stringify([{...product,qty:1}]));},products[0]);
 await context.route('**/*.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());let data=[];
  const table=url.pathname.split('/').pop();
  if(table==='categories' && req.method()==='DELETE' && failCategoryDelete) return route.fulfill({status:403,json:{message:'Test denied delete'}});
  let rows=table==='categories'?categories:table==='products'?products:[];
  const matches=row=>[...url.searchParams].every(([k,v])=>v.startsWith('eq.') ? String(row[k])===v.slice(3) : v.startsWith('in.(') ? v.slice(4,-1).split(',').includes(String(row[k])) : true);
  if(req.method()==='POST'&&!url.pathname.includes('/rpc/')){const body=req.postDataJSON();const row={id:Date.now(),...body};rows.push(row);data=[row];}
  else if(req.method()==='PATCH'){data=rows.filter(matches);data.forEach(row=>Object.assign(row,req.postDataJSON()));}
  else if(req.method()==='DELETE'){data=rows.filter(matches);if(table==='categories')categories=categories.filter(row=>!matches(row));}
  else data=rows.filter(matches);
  if(req.headers().accept?.includes('vnd.pgrst.object'))data=data[0]||null;
  await route.fulfill({json:data});
 });
 const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('/products.html');await p.waitForSelector('.prod-card');
 assert.equal(await p.locator('#category-list').innerText(),'All Collections\nGifts');
 const home=await context.newPage();await home.goto('/index.html');await home.waitForSelector('#popular-cats-slider a');assert(!(await home.locator('#popular-cats-slider').innerText()).includes('Ghost'));
 const admin=await context.newPage();await admin.goto('/admin-categories.html');await admin.waitForSelector('.category-card');
 // Exercise the real admin handlers with a test-only external Supabase API.
 await admin.evaluate(()=>{openModal();document.getElementById('cat-name').value='New Category';document.getElementById('cat-slug').value='new-category';});
 await admin.evaluate(()=>saveCategory({preventDefault(){}}));
 await p.waitForFunction(()=>document.getElementById('category-list').textContent.includes('New Category'));
 await home.waitForFunction(()=>document.getElementById('popular-cats-slider').textContent.includes('New Category'));
 products[0].category_slug='new-category';
 await admin.evaluate(()=>{const i=CATEGORIES.findIndex(c=>c.slug==='new-category');editCategory(i);document.getElementById('cat-name').value='Renamed Category';document.getElementById('cat-slug').value='renamed-category';});
 await admin.evaluate(()=>saveCategory({preventDefault(){}}));
 assert.equal(products[0].category_slug,'renamed-category');
 await p.waitForFunction(()=>document.getElementById('category-list').textContent.includes('Renamed Category'));
 admin.on('dialog',d=>d.accept());
 failCategoryDelete=true;
 await admin.evaluate(()=>deleteCategory(CATEGORIES.findIndex(c=>c.slug==='renamed-category')));
 assert(categories.some(c=>c.slug==='renamed-category'));
 assert.equal(products[0].category_slug,'renamed-category');
 failCategoryDelete=false;
 await admin.evaluate(()=>deleteCategory(CATEGORIES.findIndex(c=>c.slug==='renamed-category')));
 await p.waitForFunction(()=>!document.getElementById('category-list').textContent.includes('Renamed Category'));
 await home.waitForFunction(()=>!document.getElementById('popular-cats-slider').textContent.includes('Renamed Category'));
 assert.equal(products[0].category_slug,'');
 assert(!categories.some(c=>c.slug==='new-category'||c.slug==='renamed-category'));
 console.log('PASS category admin add/rename/delete sync across open storefront tabs');
 await admin.close();await home.close();
 const pages=fs.readdirSync(root).filter(f=>f.endsWith('.html'));
 for(const width of (process.env.TEST_WIDTHS||'320,390,768,1024,1440').split(',').map(Number)){
 await p.setViewportSize({width,height:900});
 for(const file of pages){
  await p.goto('/'+file+(file==='product-detail.html'?'?id=901':''));await p.waitForTimeout(250);
  const overflow=await p.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  if(overflow.scroll>overflow.width+1) console.log('Overflow elements',await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&getComputedStyle(el).position!=='fixed'}).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right})).filter(el=>!String(el.cls).includes('marquee')).slice(-15)));
  assert(overflow.scroll<=overflow.width+1,`${file} at ${width}: page overflow ${JSON.stringify(overflow)}`);
  if(['products.html','index.html','offers.html'].includes(file)){
   await p.waitForSelector('.prod-card h3');const name=p.locator('.prod-card h3').first();assert(await name.isVisible());
   assert(await name.evaluate(el=>el.clientHeight>=el.scrollHeight),'Product name clipped');
  }
  if(process.env.TEST_SCREENSHOTS&&width===390&&file==='products.html') await p.screenshot({path:path.join(root,'tests/mobile-products.png')});
  if(file.startsWith('admin-')&&file!=='admin-login.html'&&width<=1024){
   if(process.env.TEST_SCREENSHOTS&&width===390&&file==='admin-ads.html') await p.screenshot({path:path.join(root,'tests/mobile-admin.png')});
   await p.locator('.admin-menu-toggle').click();await p.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().left>=0);
   await p.keyboard.press('Escape');assert.equal(await p.locator('.admin-menu-toggle').getAttribute('aria-expanded'),'false');
   if(await p.locator('[onclick="openModal()"], [onclick="openModal(null)"]').count()){
    await p.locator('[onclick="openModal()"], [onclick="openModal(null)"]').first().click();
    const modal=p.locator('.modal > div').first();if(await modal.isVisible())assert(await modal.evaluate(el=>el.getBoundingClientRect().right<=innerWidth && el.getBoundingClientRect().left>=0));
   }
  }
 }
 console.log('PASS all '+pages.length+' pages at '+width+'px');
 }
 assert.deepEqual(errors,[]);console.log('PASS no page JavaScript errors');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

