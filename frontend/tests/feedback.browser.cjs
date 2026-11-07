const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const questions = new Map(); const reviews = new Map(); let n=0, generated=0; const errors=[];
  const patternRequests = [];
  page.on('pageerror', e=>errors.push(e.message));
  await page.route('**/chapbackend-api/**', async route=>{
    if (new URL(route.request().url()).pathname === "/chapbackend-api/usage/events") return route.fulfill({ contentType: "application/json", body: "{\"accepted\":true}" });
    const p=new URL(route.request().url()).pathname.replace('/chapbackend-api','');
    const body=route.request().method()==='POST'?route.request().postDataJSON():{};
    let value;
    if(p==='/me')value={chapp_user_id:'feedback-owner'};
    else if(p==='/login-completions')value={source_state:'ready'};
    else if(p==='/attempts'||p==='/exercises/failed')value=[];
    else if(p==='/daily-plan/session')value=[
      {kind:'listening',pattern_attempt_id:'saved-mistake',review_number:2},
      {kind:'reading'}, {kind:'reverse'},
    ];
    else if(p==='/attempts/saved-mistake/pattern-review'){
      assert.equal(body.number,2);
      assert.ok(body.request_id);
      patternRequests.push(body.request_id);
      if (patternRequests.length === 1) return route.fulfill({status: 500, body: 'Temporary error'});
      const id=String(++n);
      value={id,mandarin:'',difficulty:'beginner',answer_language:'en',listening:{length_level:0,character_difficulty:0}};
      questions.set(id,value);
    }
    else if(p==='/exercises'){
      generated++;const id=String(++n);
      value={id,mandarin:body.listening?'':body.reverse?'I am well.':'我很好。',difficulty:body.difficulty,answer_language:body.reverse?'zh-Hans':'en',listening:body.listening};
      questions.set(id,value);
    }else if(p.startsWith('/attempts/'))value=reviews.get(p.split('/')[2]);
    else if(p.endsWith('/attempts')){
      const q=questions.get(p.split('/')[2]);
      value={answer:{id:'a'+n,text:body.text,exercise_id:q.id,submitted_at:new Date().toISOString()},question:{...q,content:{mandarin:'我很好。',english:'I am well.',pinyin:'wǒ hěn hǎo'}},assessments:[{state:'completed',result:{correctness:1,feedback:'Good.',suggested_translation:q.answer_language==='en'?'I am well.':'我很好。'}}]};
      reviews.set(value.answer.id,value);
    }else if(p.endsWith('/events'))value={saved:true};
    else throw Error(p);
    await route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  });
  try{
    await page.goto((process.env.LEARNING_TEST_ORIGIN || 'http://localhost:3010') + '/sentences');
    assert.equal(await page.getByRole('list', { name: 'Exercise progress' }).count(), 0);
    await page.getByRole('button',{name:'Generate sentence',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Listen',exact:true}).count(),0);
    const draft = page.getByRole('textbox',{name:/Your English translation/});
    const picker = page.getByRole('group',{name:'Exercise layout'});
    const exercise = page.getByRole('region',{name:'Current exercise'});
    const prompt = exercise.locator('p[lang="zh-CN"]');
    await draft.fill('I am well.');
    assert.equal(await picker.getByRole('radio').count(),5);
    const classic = await exercise.boundingBox();
    const classicPrompt = await prompt.boundingBox();
    const initialGenerationCount = generated;
    for (const name of ['Compact', 'Focus', 'Split', 'Immersive', 'Classic']) {
      await picker.getByRole('radio',{name,exact:true}).check();
      assert.equal(await draft.inputValue(),'I am well.');
      if (name === 'Compact') assert.ok((await exercise.boundingBox()).height < classic.height);
      if (name === 'Focus') assert.ok((await exercise.boundingBox()).width < classic.width);
      if (name === 'Split') assert.ok((await draft.boundingBox()).x >= (await prompt.boundingBox()).x + (await prompt.boundingBox()).width);
      if (name === 'Immersive') assert.ok((await prompt.boundingBox()).height > classicPrompt.height);
    }
    assert.equal(generated,initialGenerationCount,'Changing layouts keeps the issued exercise');
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
    await page.getByRole('button',{name:'Close learning chat',exact:true}).click();
    await page.getByRole('textbox',{name:/Your Mandarin translation/}).fill('我很好。');
    await page.getByRole('button',{name:'Submit for grading',exact:true}).click();
    const review = page.getByRole('region',{name:'Answer review'});
    await review.getByRole('button',{name:'Explore 我',exact:true}).waitFor();
    assert.equal(await page.locator('p[lang="en"]').filter({hasText:'I am well.'}).count(),1);
    assert.equal(await page.getByRole('textbox',{name:/Your Mandarin translation/}).inputValue(),'我很好。');
    await picker.getByRole('radio',{name:'Focus',exact:true}).check();
    await page.reload();
    await review.getByRole('button',{name:'Explore 我',exact:true}).waitFor();
    assert.ok(await picker.getByRole('radio',{name:'Focus',exact:true}).isChecked());
    assert.equal(await page.locator('p[lang="en"]').filter({hasText:'I am well.'}).count(),1);
    await page.goto((process.env.LEARNING_TEST_ORIGIN || 'http://localhost:3010') + '/practice');
    await picker.getByRole('radio',{name:'Classic',exact:true}).check();
    await page.getByRole('button',{name:'Create daily plan',exact:true}).click();
    await page.getByRole('heading',{name:'Exercise 1 of 3'}).waitFor();
    await page.getByText('Pattern review · Listening',{exact:true}).waitFor();
    await page.getByRole('alert').filter({hasText:'The request could not complete'}).waitFor();
    assert.equal(patternRequests.length,1,'Creating the plan opens the first exercise automatically');
    await page.getByRole('button',{name:'Retry exercise',exact:true}).click();
    await page.getByRole('textbox',{name:/What did you hear/}).fill('I am well.');
    assert.deepEqual(patternRequests,[patternRequests[0],patternRequests[0]],'Retry reuses the first slot request ID');
    assert.equal(await page.getByRole('region',{name:'Your practice queue'}).count(),0);
    assert.equal(await page.getByText('我很好。',{exact:true}).count(),0);
    await page.getByRole('button',{name:'Submit for grading',exact:true}).click();
    await review.waitFor();
    assert.equal(await page.getByRole('progressbar',{name:'Daily plan exercises answered'}).getAttribute('value'),'1');
    await page.getByRole('button',{name:'Next exercise',exact:true}).click();
    await page.getByRole('heading',{name:'Exercise 2 of 3'}).waitFor();
    await page.waitForFunction(() => document.activeElement?.textContent === 'Exercise 2 of 3');
    assert.equal(await review.count(),0);
    assert.equal(await page.getByRole('textbox',{name:/Your English translation/}).inputValue(),'');
    await page.getByRole('button',{name:'Don’t know',exact:true}).click();
    await review.waitFor();
    await page.getByRole('button',{name:'Next exercise',exact:true}).click();
    await page.getByRole('heading',{name:'Exercise 3 of 3'}).waitFor();
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('textbox',{name:/Your Mandarin translation/}).fill('我很好。');
    for (const name of ['Compact', 'Focus', 'Split', 'Immersive', 'Classic']) {
      await picker.getByRole('radio',{name,exact:true}).check();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await page.getByRole('heading',{name:'Exercise 3 of 3'}).count(),1);
      assert.equal(await page.getByRole('textbox',{name:/Your Mandarin translation/}).inputValue(),'我很好。');
    }
    await page.getByRole('button',{name:'Submit for grading',exact:true}).click();
    await review.waitFor();
    await page.getByRole('button',{name:'Finish daily plan',exact:true}).click();
    await page.getByText('Daily plan complete. You answered all 3 exercises.',{exact:true}).waitFor();
    await page.getByRole('region',{name:'Your practice queue'}).waitFor();
    await page.waitForFunction(() => document.activeElement?.textContent === 'Create daily plan');
    await page.getByRole('button',{name:'Create daily plan',exact:true}).click();
    await page.getByRole('textbox',{name:/What did you hear/}).waitFor();
    assert.equal(await page.getByRole('heading',{name:'Exercise 1 of 3'}).count(),1);
    await page.getByRole('button',{name:'End plan',exact:true}).click();
    await page.getByText('Daily plan ended. 0 of 3 exercises answered.',{exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('Feedback flows passed: audio reveal, next pre-generation, both translations, daily plan and mobile.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
