const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const questions = new Map(); let n=0, generated=0; const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.route('**/chapbackend-api/**', async route=>{
    const p=new URL(route.request().url()).pathname.replace('/chapbackend-api','');
    const body=route.request().method()==='POST'?route.request().postDataJSON():{};
    let value;
    if(p==='/me')value={chapp_user_id:'feedback-owner'};
    else if(p==='/login-completions')value={source_state:'ready'};
    else if(p==='/attempts'||p==='/exercises/failed')value=[];
    else if(p==='/daily-plan')value=['reading','reverse','listening'];
    else if(p==='/exercises'){
      generated++;const id=String(++n);
      value={id,mandarin:body.listening?'':body.reverse?'I am well.':'我很好。',difficulty:body.difficulty,answer_language:body.reverse?'zh-Hans':'en',listening:body.listening};
      questions.set(id,value);
    }else if(p.endsWith('/attempts')){
      const q=questions.get(p.split('/')[2]);
      value={answer:{id:'a'+n,text:body.text,exercise_id:q.id,submitted_at:new Date().toISOString()},question:{...q,content:{mandarin:'我很好。',english:'I am well.',pinyin:'wǒ hěn hǎo'}},assessments:[{state:'completed',result:{correctness:1,feedback:'Good.',suggested_translation:q.answer_language==='en'?'I am well.':'我很好。'}}]};
    }else if(p.endsWith('/events'))value={saved:true};
    else throw Error(p);
    await route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  });
  try{
    await page.goto('http://localhost:3010/sentences');
    await page.getByRole('button',{name:'Generate sentence',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Listen',exact:true}).count(),0);
    await page.getByRole('textbox',{name:/Your English translation/}).fill('I am well.');
    await page.getByRole('button',{name:'Submit for grading',exact:true}).click();
    await page.getByRole('region',{name:'Answer review'}).waitFor();
    await page.waitForFunction(()=>document.querySelectorAll('button[aria-label^="Explore "]').length>0);
    await page.waitForTimeout(100);
    const before=generated;
    assert.equal(before,2,'Answering starts one next-question request');
    await page.getByRole('button',{name:'Generate next sentence',exact:true}).click();
    await page.getByRole('button',{name:'Submit for grading',exact:true}).waitFor();
    assert.equal(generated,before,'Next uses the prepared question');
    await page.getByLabel('Translation direction',{exact:false}).selectOption('reverse');
    await page.getByRole('button',{name:'Generate next sentence',exact:true}).click();
    await page.getByRole('textbox',{name:/Your Mandarin translation/}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Listen',exact:true}).count(),0);
    assert.equal(await page.getByText('我很好。',{exact:true}).count(),0,'Reverse reference remains hidden');
    await page.getByRole('button',{name:'Ask about your practice',exact:true}).click();
    const box=await page.locator('[aria-label="Learning companion"]').boundingBox().catch(()=>null);
    if(box)assert.ok(box.width>=600);
    await page.goto('http://localhost:3010/practice');
    await page.getByRole('button',{name:'Create daily plan',exact:true}).click();
    await page.getByText(/0 of 3 exercises answered/).waitFor();
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);
    console.log('Feedback flows passed: audio reveal, next pre-generation, both translations, daily plan and mobile.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
