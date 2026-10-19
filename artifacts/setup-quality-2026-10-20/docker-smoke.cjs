const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
(async () => {
  let token;
  for (let attempt=0;attempt<80;attempt++) {
    const logs = execFileSync('docker', ['compose', '-p', 'clinic-setup-quality', '-f', '/tmp/clinic-setup-quality.compose.yaml', 'logs', '--no-color'], {encoding:'utf8'});
    token = [...logs.matchAll(/#token=([a-f0-9]{64})/g)].at(-1)?.[1];
    if (token) break;
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert(token, 'Local disposable runtime must provide its launch token');
  const root = fs.readFileSync('/tmp/clinic-setup-quality-smoke-root.txt','utf8');
  const directory = 'project-smoke-' + Date.now();
  const sourcePath = path.join(root,directory,'packages/shop/src/catalog.ts');
  fs.mkdirSync(path.dirname(sourcePath),{recursive:true});
  fs.writeFileSync(sourcePath,'export const active = products => products.filter(product => product.active);\n');
  fs.writeFileSync(path.join(root,directory,'README.md'),'# Catalog\nVisitors browse active products; an empty catalog has no items.\n');
  const before = fs.readFileSync(sourcePath,'utf8');
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const page = await browser.newPage({viewport:{width:1500,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:4327/#token=${token}`);
    await page.getByRole('heading',{name:'Projects',exact:true}).waitFor();
    const connected=await page.request.post('http://127.0.0.1:4327/api/engines/claude/connect',{data:{path:'/projects/engine.cjs'}});
    assert(connected.ok(), await connected.text());
    await page.getByRole('button',{name:'Add project',exact:true}).click();
    await page.getByLabel('Project directory').fill(`/projects/${directory}`);
    await page.getByLabel('Project name').fill('Setup quality smoke');
    await page.getByLabel('Default engine').selectOption('claude');
    await page.getByRole('button',{name:'Inspect & set up'}).click();
    await page.getByRole('heading',{name:'Review proposed changes',exact:true}).waitFor({timeout:60000});
    assert(!fs.existsSync(path.join(root,directory,'openspec/specs/catalog/spec.md')),'No setup writes before review');
    await page.locator('.diff-layout nav button').filter({has:page.getByText('openspec/project/setup-review.md',{exact:true})}).click();
    const report=await page.locator('.diff-content').innerText();
    assert(report.includes('Implementation readiness: requires refinement'));
    assert(report.includes('1.14.2'));
    assert(report.includes('accessibility'));
    await page.screenshot({path:path.join(__dirname,'docker-quality-review.png'),fullPage:true});
    await page.locator('.diff-layout nav button').filter({has:page.getByText('openspec/specs/catalog/validation.md',{exact:true})}).click();
    const plan=await page.locator('.diff-content').innerText();
    assert(plan.includes('proposed-test'));assert(plan.includes('Prerequisites:'));assert(plan.includes('Fixture:'));
    await page.getByRole('button',{name:/Apply \d+ files/}).click();
    await page.getByRole('heading',{name:'Review proposed changes',exact:true}).waitFor({state:'hidden'});
    assert.equal(fs.readFileSync(sourcePath,'utf8'),before);
    const saved=fs.readFileSync(path.join(root,directory,'openspec/project/setup-review.md'),'utf8');
    assert(saved.includes('no application tests run'));
    assert(fs.existsSync(path.join(root,directory,'openspec/project/architecture.md')));
    await page.setViewportSize({width:375,height:950});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth)<=375);
    await page.screenshot({path:path.join(__dirname,'docker-applied-mobile.png'),fullPage:true});
    const state=await (await page.request.get('http://127.0.0.1:4327/api/state')).json();
    const project=state.projects.find(p=>p.path===`/projects/${directory}`);
    assert(project);
    const second=await (await page.request.post(`http://127.0.0.1:4327/api/projects/${project.id}/setup`,{data:{mode:'analyze'}})).json();
    let done;
    for(let i=0;i<120;i++) {
      done=(await (await page.request.get(`http://127.0.0.1:4327/api/runs/${second.run.id}`)).json()).run;
      if(['completed','failed','interrupted'].includes(done.status)) break;
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    assert.equal(done.status,'completed',done.error);
    const refreshed=await (await page.request.get(`http://127.0.0.1:4327/api/projects/${project.id}`)).json();
    const proposal=refreshed.proposals.find(p=>p.id===done.proposalId);
    assert(proposal.files.some(f=>f.path==='openspec/project/setup-review.md' && f.after.includes('Validation follow-up for preserved specifications')));
    assert(!proposal.files.some(f=>f.path.startsWith('openspec/specs/')),'Reuse review preserves accepted specs and companions');
    assert.equal(fs.readFileSync(sourcePath,'utf8'),before);
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(__dirname,'docker-smoke.json'),JSON.stringify({runtime:'Docker Compose isolated service, built from implementation worktree',provider:'scripted Claude adapter; no live model inference',checks:['browser launch','separate quality review','concrete validation plan','no writes before apply','reviewed apply','source unchanged','new architecture guidance','mobile viewport','zero uncaught browser errors','reuse-only quality review with preserved specs and companions'],result:'passed'},null,2)+'\n');
    console.log('Docker/browser setup smoke passed; source unchanged and all generated checks remain unverified.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
