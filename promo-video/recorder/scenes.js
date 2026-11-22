// Screen recordings of the real app used as phone/laptop screen content.
const { createRecorder } = require('./rec');
const S = process.env.SCRATCH; const URL = 'https://coach-daniel.expo.app';
const A = S + '/tools/stateA.json', B = S + '/tools/stateB.json';
const out = (n) => S + '/rec/' + n;

const scenes = {
  async assigned() {
    const rec = await createRecorder({ out: out('assigned'), storageState: A });
    const p = rec.page;
    await rec.goto(URL); await rec.ready(); await rec.dismissTour();
    await rec.enable(); rec.mark('start'); await rec.hold(1.5);
    await rec.tap(p.getByRole('tab', { name: /אימונים/ }).first(), { lead: 0.3 });
    await rec.offline(async () => { await p.waitForTimeout(2500); });
    rec.mark('workouts'); await rec.hold(1.5);
    await rec.close();
  },
  async coach() {
    const rec = await createRecorder({ out: out('coach'), storageState: A, viewport: { width: 1440, height: 900 }, dpr: 1.5 });
    const p = rec.page; p.on('dialog', d => { console.log('dialog:', d.message()); d.accept(); });
    const btn = (n) => p.getByRole('button', { name: n, exact: true });
    await rec.goto(URL + '/admin/editor'); await p.waitForTimeout(3000);
    await p.locator('a:visible', { hasText: /^תרגילים$/ }).first().click(); await p.waitForTimeout(2000);
    await rec.enable(); rec.mark('library'); await rec.hold(0.8);
    await rec.scroll(1500, 2.4); await rec.hold(0.3);
    rec.mark('programs'); await rec.tap(p.locator('a:visible', { hasText: /^תוכניות$/ }).first(), { lead: 0.2 });
    await rec.offline(async () => { await p.getByText('כוח והיפרטרופיה - 4 ימים').first().waitFor(); await p.waitForTimeout(600); });
    await rec.hold(0.5);
    await rec.tap(p.getByText('כוח והיפרטרופיה - 4 ימים').first(), { lead: 0.25 });
    await rec.offline(async () => { await p.getByText('אימון A - חזה וכתפיים').first().waitFor(); await p.waitForTimeout(600); await p.getByText('אימון A - חזה וכתפיים').first().click(); await p.waitForTimeout(1200); });
    rec.mark('editor'); await rec.hold(1.2);
    await rec.scroll(1650, 1.6); await rec.hold(0.3);
    rec.mark('addex');
    const sel = p.getByLabel('בחירת תרגיל מהספרייה').nth(-2);
    await rec.tap(sel, { lead: 0.25 }); await sel.selectOption({ label: 'פרפר במכונה' }); await rec.hold(0.5);
    await rec.tap(btn('הוספת תרגיל'), { lead: 0.25, after: 0.4 });
    await rec.offline(async () => { await p.waitForTimeout(1200); });
    await rec.scroll(260, 0.6); await rec.hold(0.2);
    const L = (l, i) => p.getByLabel(l, { exact: true }).nth(i);
    const n = await p.getByLabel('חזרות מ־', { exact: true }).count();
    for (let r = n - 3; r < n; r++) {
      await rec.tap(L('חזרות מ־', r), { lead: 0.1 }); await rec.type(L('חזרות מ־', r), '12', { cps: 14 });
      await rec.tap(L('עד', 2 * r), { lead: 0.08 }); await rec.type(L('עד', 2 * r), '15', { cps: 14 });
      await rec.tap(L('משקל יעד', r), { lead: 0.08 }); await rec.type(L('משקל יעד', r), '40', { cps: 14 });
      await rec.tap(L('מנוחה (שנ׳)', r), { lead: 0.08 }); await rec.type(L('מנוחה (שנ׳)', r), '60', { cps: 14 });
    }
    await rec.hold(0.4);
    await rec.scroll(-4000, 1.2); await rec.hold(0.3);
    rec.mark('publish'); await rec.tap(btn('פרסום גרסה').first(), { lead: 0.3 });
    await rec.offline(async () => { await p.waitForTimeout(800); });
    await rec.hold(0.6);
    rec.mark('confirm'); await rec.tap(btn('פרסום גרסה').last(), { lead: 0.3 });
    await rec.offline(async () => { await p.waitForTimeout(2500); });
    await rec.hold(1.2);
    rec.mark('trainees'); await rec.tap(p.locator('a:visible', { hasText: /^מתאמנים$/ }).first(), { lead: 0.25 });
    await rec.offline(async () => { await p.waitForTimeout(2500); });
    await rec.hold(0.8);
    const vs = p.getByLabel('שיוך גרסת תוכנית');
    console.log('assign select count', await vs.count(), await vs.first().evaluate(e => [...e.options].map(o => o.text)).catch(e => 'n/a'));
    await rec.tap(vs.first(), { lead: 0.25 });
    const opts = await vs.first().evaluate(e => [...e.options].map(o => o.value));
    await vs.first().selectOption(opts[opts.length - 1]); await rec.hold(0.5);
    rec.mark('assign'); await rec.tap(btn('שיוך').first(), { lead: 0.3 });
    await rec.offline(async () => { await p.waitForTimeout(2500); });
    await rec.hold(1.6);
    await rec.close();
  },
  async onboarding() {
    const rec = await createRecorder({ out: out('onboarding'), saveState: S + '/tools/stateC.json' });
    const p = rec.page; const t = (x) => p.getByText(x, { exact: true });
    await rec.goto(URL); await p.waitForTimeout(1500);
    await rec.enable(); rec.mark('login'); await rec.hold(1.2);
    await rec.tap(t('כניסה בלי הרשמה'));
    await rec.offline(async () => { await p.getByText('שאלה 1 מתוך 6').waitFor({ timeout: 30000 }); await p.waitForTimeout(800); });
    rec.mark('q1'); await rec.hold(0.4);
    await rec.tap(p.locator('input').first(), { lead: 0.15 }); await rec.type(p.locator('input').first(), 'דניאל', { cps: 9 }); await rec.hold(0.3);
    await rec.tap(t('המשך'), { after: 0.5 }); rec.mark('q2');
    await rec.tap(t('זכר'), { after: 0.25 }); await rec.tap(t('המשך'), { after: 0.5 }); rec.mark('q3');
    await rec.tap(p.locator('input').first(), { lead: 0.1 }); await p.locator('input').first().fill('29'); await rec.hold(0.35);
    await rec.tap(t('המשך'), { after: 0.5 }); rec.mark('q4');
    await rec.tap(p.locator('input').nth(0), { lead: 0.1 }); await p.locator('input').nth(0).fill('178'); await rec.hold(0.3);
    await rec.tap(p.locator('input').nth(1), { lead: 0.1 }); await p.locator('input').nth(1).fill('76'); await rec.hold(0.35);
    await rec.tap(t('המשך'), { after: 0.5 }); rec.mark('q5');
    await rec.tap(t('בינוני (3-4)'), { after: 0.25 }); await rec.tap(t('המשך'), { after: 0.5 }); rec.mark('q6');
    await rec.tap(t('עלייה במסת שריר'), { after: 0.25 }); await rec.tap(t('המשך'));
    await rec.offline(async () => { await p.getByText('היעדים שלך').waitFor({ timeout: 30000 }); await p.waitForTimeout(600); });
    rec.mark('goals'); await rec.hold(2.5);
    await rec.tap(t('שמירה והתחלה'));
    await rec.offline(async () => { await p.getByText('התחל אימון').waitFor({ timeout: 40000 }); await p.waitForTimeout(1500); const s = p.getByText('דילוג', { exact: true }); if (await s.count()) { await s.first().click(); await p.waitForTimeout(800); } });
    rec.mark('home'); await rec.hold(1.5);
    await rec.close();
  },
  async workout() {
    const rec = await createRecorder({ out: out('workout'), storageState: B });
    const p = rec.page;
    await rec.goto(URL); await rec.ready();
    await rec.dismissTour();
    await rec.enable(); rec.mark('home'); await rec.hold(0.8);
    await rec.tap(p.getByText(/התחל אימון|המשך אימון/).first());
    await rec.offline(async () => { await p.getByText('סיים סט').waitFor({ timeout: 30000 }); await p.waitForTimeout(600); });
    rec.mark('exercise'); await rec.hold(1.0);
    const w = p.getByLabel('משקל, ק״ג').first();
    await rec.tap(w, { lead: 0.2 }); await rec.type(w, '60', { cps: 6 }); await rec.hold(0.3);
    await rec.tap(p.getByRole('button', { name: 'הגדל חזרות' }).first(), { lead: 0.2, after: 0.15 });
    await rec.tap(p.getByRole('button', { name: 'הגדל חזרות' }).first(), { lead: 0.15, after: 0.4 });
    rec.mark('finish'); await rec.tap(p.getByRole('button', { name: 'סיים סט' }), { lead: 0.25 });
    rec.mark('rest'); await rec.hold(1.4); await rec.hold(2.0, { speed: 15 }); await rec.hold(0.6);
    await rec.close();
  },
  async nutrition() {
    const rec = await createRecorder({ out: out('nutrition'), storageState: S + '/tools/stateC.json' });
    const p = rec.page;
    await rec.goto(URL + '/nutrition'); await rec.ready(); await rec.dismissTour();
    await rec.enable(); rec.mark('start'); await rec.hold(0.8);
    rec.mark('eat1'); await rec.tap(p.getByRole('checkbox', { name: 'סמן ארוחה - ארוחת בוקר - מוזלי' }), { lead: 0.3, after: 1.0 });
    rec.mark('scroll'); await rec.scroll(560, 1.3); await rec.hold(0.3);
    rec.mark('eat2'); await rec.tap(p.getByRole('checkbox', { name: 'סמן ארוחה - ארוחת צהריים - בשר/עוף' }), { lead: 0.3, after: 0.8 });
    rec.mark('swap'); await rec.tap(p.getByRole('button', { name: 'החלף חזה עוף לאחר בישול' }), { lead: 0.3 });
    await rec.hold(1.8);
    await rec.close();
  },
  async metrics() {
    const rec = await createRecorder({ out: out('metrics'), storageState: A });
    const p = rec.page;
    await rec.goto(URL + '/metrics'); await rec.ready(); await rec.dismissTour();
    await rec.enable(); rec.mark('start'); await rec.hold(0.8);
    await rec.scroll(300, 1.2); rec.mark('chart'); await rec.hold(2.0);
    await rec.close();
  },
  async home() {
    const rec = await createRecorder({ out: out('home'), storageState: A });
    const p = rec.page;
    await rec.goto(URL); await rec.ready(); await rec.dismissTour();
    await rec.enable(); rec.mark('start'); await rec.hold(0.6);
    await rec.scroll(820, 2.6); await rec.hold(0.6);
    await rec.close();
  },
};
(async () => {
  for (const n of process.argv.slice(2)) { console.log('==', n); const t0 = Date.now(); await scenes[n](); console.log(n, 'took', ((Date.now() - t0) / 1000).toFixed(0), 's'); }
})().catch(e => { console.error(e); process.exit(1); });
