// End-to-end tests: a person fills real pages with the widget in Chromium.
//
// Scenarios (all must pass):
//   1. Practice portal, English, tapping and typing, desktop. No Sarvam key (as graders run it).
//   2. The same on a phone screen.
//   3. Practice portal, Tamil, by VOICE: Chromium's fake microphone and a stand-in for Sarvam (no key, no network).
//   4. Practice portal, Tamil, no handoff: the page's own "Fill by voice" button; every detail is asked.
//   5. From the Urimai website: questions → results → "Fill the application with Urimai" → new tab → portal.
//   6. A site whose checks the widget does not know (HTML pattern, alert pop-up, late error, unmapped required box,
//      email the browser refuses, server error shown only in a page summary).
// Every scenario checks the "never" rules: the widget sends no form, clicks no button, and the Aadhaar number never
// leaves the page.
//
// Usage: npm run e2e            all scenarios
//        npm run e2e -- 3 6     only some
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const AADHAAR = '123412341234'
const frontendDist = path.join(root, 'frontend/dist')

class Fail extends Error {}
const fail = (msg) => { throw new Fail(msg) }

function startServer(mode, port) {
  const args = [path.join(here, 'server.py'), path.resolve(here, '../../dist-test'), String(port), mode]
  if (fs.existsSync(path.join(frontendDist, 'index.html'))) args.push(frontendDist)
  const proc = spawn(path.join(root, 'backend/.venv/bin/python'), args, { stdio: ['ignore', 'inherit', 'inherit'] })
  return { proc, base: `http://127.0.0.1:${port}` }
}

async function waitFor(base) {
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  fail(`server ${base} did not start`)
}

const GUARDS = () => {
  window.__never = []
  const proto = HTMLFormElement.prototype
  for (const name of ['submit', 'requestSubmit']) {
    const original = proto[name]
    proto[name] = function (...args) {
      const caller = (new Error().stack || '').split('\n')[2] || ''
      if (caller.includes('/widget/')) window.__never.push(`form.${name} called by the widget`)
      return original.apply(this, args)
    }
  }
  document.addEventListener('click', (e) => {
    const t = e.target
    if (!e.isTrusted && t.closest && t.closest('button, input[type=submit], input[type=image], a')) window.__never.push(`untrusted click on ${t.tagName}#${t.id}`)
  }, true)
}

// What the scripted person says or does, by field key and phase. n = how many times this step has come up.
const by = (en, ta) => (lang) => (lang === 'ta' ? ta : en)
const VALUES = {
  name_ta: () => 'செல்வி முருகன்',
  name_en: () => 'S E L V I  M U R U G A N',
  husband_name: () => 'Murugan',
  gender: by('female', 'பெண்'),
  dob: by('14 March 1968', '14 மார்ச் 1968'),
  marital: by('widow', 'விதவை'),
  community: by('M B C', 'எம் பி சி'),
  mobile: (lang, n) => (n === 1 ? '12345' : '98765 43211'),
  district: () => 'Madurai',
  taluk: () => 'Melur',
  village: () => 'melur ward 2',
  door_no: () => 'No. 12',
  street: () => 'Gandhi Street',
  pincode: by('six two five one zero six', 'ஆறு இரண்டு ஐந்து ஒன்று பூஜ்ஜியம் ஆறு'),
  applicant: () => 'Selvi Murugan',
  ration: (lang, n) => (n === 1 ? 'ab 123' : 'TN123456'),
  family: (lang, n) => (n === 1 ? '25' : '4'),
  village_code: (lang, n) => (n === 1 ? 'VC999' : 'VC100'),
  income: (lang, n) => (n === 1 ? '150000' : '90000'),
}
const YES = by('yes', 'ஆமாம்')
const DONE = by('done', 'முடிந்தது')

async function scenario(browser, server, sc) {
  const context = await browser.newContext(sc.phone
    ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 900 } })
  if (sc.voice) await context.grantPermissions(['microphone'], { origin: server.base })
  await context.addInitScript(GUARDS)
  const errors = []
  const widgetBodies = []
  const calls = { listen: 0, speak: 0, understand: 0 }
  context.on('request', (r) => {
    const u = r.url()
    if (!u.includes('/api/widget/')) return
    widgetBodies.push(r.postData() || '')
    for (const k of Object.keys(calls)) if (u.endsWith('/' + k)) calls[k]++
  })
  let page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  const B = server.base

  // ---- how the person gets to the form ----
  if (sc.entry === 'handoff') {
    await page.goto(`${B}/api/demo/handoff?form_id=demo-destitute-widow-pension&lang=${sc.lang}`)
    if (page.url().includes('urimai=')) fail('the one-time code was not removed from the address')
  } else if (sc.entry === 'launcher') {
    await page.goto(`${B}/portal/pension/apply`)
  } else if (sc.entry === 'fixture') {
    await page.goto(`${B}/fixtures/odd/apply`)
  } else if (sc.entry === 'website') {
    page = await viaWebsite(context, page, B, sc.lang)
    page.on('pageerror', (e) => errors.push(e.message))
  }
  await page.waitForFunction(() => window.__urimaiTest, null, { timeout: 10000 })
  if (sc.entry === 'launcher' || sc.entry === 'fixture') {
    // The page's own button: open the helper and choose the language.
    await page.click('.launcher')
    await page.evaluate((l) => window.__urimaiTest.tap('value', l), sc.lang)
  }

  // ---- the conversation ----
  const counts = {}
  const seen = []
  const t = (fn, arg) => page.evaluate(fn, arg)
  const transcript = () => page.evaluate(() => document.querySelector('#urimai-widget-host')?.shadowRoot.querySelector('.log')?.textContent ?? '')
  const tap = (intent, value) => t(([i, v]) => window.__urimaiTest.tap(i, v), [intent, value])
  async function say(text) {
    if (!sc.voice) return t((x) => window.__urimaiTest.hear(x), text)
    await page.request.post(`${B}/_test/transcript`, { data: { text } })
    await page.click('.mic')
    await page.waitForSelector('.mic.rec', { timeout: 5000 })
    await page.waitForTimeout(600)
    await page.click('.mic')
  }
  const nav = async (selector) => {
    try {
      await Promise.all([page.waitForNavigation({ timeout: 10000 }), page.click(selector)])
    } catch {
      const invalid = await page.evaluate(() => [...document.querySelectorAll('input')].filter((i) => !i.validity.valid).map((i) => `${i.id}: ${i.validationMessage}`))
      fail(`pressing ${selector} did not change the page. Invalid boxes: ${invalid.join('; ')}. Steps: ${seen.slice(-8).join(', ')}. Last messages: ${(await transcript()).slice(-300)}`)
    }
  }
  const doneAfter = (fn) => async () => { await fn(); await say(DONE(sc.lang)) }
  let aadhaarTries = 0
  const ACTIONS = {
    'start:start': () => tap('yes'),
    'mobile:confirm': (n) => (n === 1 ? say(sc.lang === 'ta' ? 'இல்லை, 9876543210' : 'no, it is 9876543210') : say(YES(sc.lang))),
    'aadhaar:done': doneAfter(() => page.fill('#AadhaarNo', aadhaarTries++ === 0 ? AADHAAR.slice(1) : AADHAAR)),
    'save_next:nav': () => nav('#btnSaveNext'),
    'photo:done': doneAfter(() => page.setInputFiles('#Photo', { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') })),
    'death_certificate:done': doneAfter(() => page.setInputFiles('#DeathCertificate', { name: 'death.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 demo') })),
    'declaration:done': doneAfter(() => page.check('#Declaration')),
    'captcha:done': doneAfter(async () => page.fill('#CaptchaText', await (await context.request.get(`${B}/portal/_test/captcha`)).text())),
    'submit:nav': () => nav('#btnSubmit'),
    'extra:fa:done': doneAfter(() => page.fill('#fa', 'Murugan')),
    'extra:e:done': doneAfter(() => page.fill('#e', 'person@example.com')),
    'send:nav': async (n) => {
      if (n === 1) { await page.fill('#e', 'not-an-email'); await page.click('#send'); return } // the browser refuses it
      await nav('#send')
    },
    'which:value': () => tap('value', sc.lang === 'ta' ? 'ஆண்டு வருமானம்' : 'Annual income'),
  }
  const finishPath = sc.entry === 'fixture' ? '/fixtures/odd/done' : '/portal/pension/done'
  for (let turn = 0; turn < 200; turn++) {
    if (page.url().endsWith(finishPath)) break
    try {
      await page.waitForFunction(() => window.__urimaiTest && window.__urimaiTest.waiting(), null, { timeout: 15000 })
    } catch {
      if (page.url().endsWith(finishPath)) break
      fail(`the widget stopped waiting. Last messages: ${(await transcript()).slice(-400)}`)
    }
    const cur = await t(() => window.__urimaiTest.current())
    const key = `${cur.key}:${cur.phase}`
    counts[key] = (counts[key] ?? 0) + 1
    seen.push(key)
    if (counts[key] > 4) fail(`stuck on ${key}. Last messages: ${(await transcript()).slice(-400)}`)
    const n = counts[key]
    const turnBefore = await t(() => window.__urimaiTest.turn())
    if (ACTIONS[key]) await ACTIONS[key](n)
    else if (cur.phase === 'value' && VALUES[cur.key]) await say(VALUES[cur.key](sc.lang, n))
    else if (cur.phase === 'confirm') await say(YES(sc.lang))
    else fail(`no scripted answer for ${key}. Last messages: ${(await transcript()).slice(-300)}`)
    // Wait for the widget's next question (or a new page) before answering again.
    if (!page.url().endsWith(finishPath)) {
      await page.waitForFunction((before) => !window.__urimaiTest || window.__urimaiTest.turn() !== before, turnBefore, { timeout: 15000 }).catch(() => undefined)
    }
  }

  // ---- checks ----
  await page.waitForTimeout(700)
  const log = await transcript()
  const reference = sc.entry === 'fixture' ? 'FIX-123456' : await page.textContent('#AckNo')
  if (!log.includes(reference)) fail(`the widget did not read the reference number ${reference}`)
  if ((await page.evaluate(() => JSON.stringify(sessionStorage))).includes('urimai-widget')) fail('tab state was not cleared')
  const never = await page.evaluate(() => window.__never)
  if (never.length) fail('never-rules broken: ' + never.join('; '))
  if (widgetBodies.some((b) => b.includes(AADHAAR) || b.includes(AADHAAR.slice(1)))) fail('an Aadhaar number was sent to the server')
  if (errors.length) fail('page errors: ' + errors.join('; '))
  const asked = (k) => counts[k] ?? 0
  if (sc.entry !== 'fixture') {
    if (aadhaarTries !== 2) fail('the server-side Aadhaar error was not recovered from')
    if (asked('mobile:value') < 2) fail('the bad mobile number was not asked again')
  }
  if (sc.voice) {
    if (calls.listen < 10) fail(`expected the microphone path to be used, saw ${calls.listen} listen calls`)
    if (calls.speak < 5) fail(`expected spoken questions, saw ${calls.speak} speak calls`)
    if (asked('name_en:value')) fail('the English-letters name should come from transliteration, not be asked')
  } else {
    if (calls.listen || calls.speak) fail('no key: the widget must not call listen or speak')
    if (!(await page.evaluate(() => document.querySelector('#urimai-widget-host').shadowRoot.querySelector('.mic').hidden))) fail('no key: the microphone button should be hidden')
  }
  if (sc.entry === 'handoff' || sc.entry === 'website') {
    if (asked('district:value') || asked('marital:value')) fail('carried values should be confirmed, not asked')
  }
  if (sc.entry === 'launcher' && !(asked('district:value') && asked('marital:value'))) fail('without a handoff, everything should be asked')
  if (sc.entry === 'fixture') {
    for (const k of ['ration:value', 'family:value', 'village_code:value', 'income:value']) if (asked(k) !== 2) fail(`${k} should be asked twice (site refused the first), was ${asked(k)}`)
    for (const k of ['extra:fa:done', 'extra:e:done', 'which:value']) if (!asked(k)) fail(`step not reached: ${k}`)
    for (const text of ['more than 20', 'Unknown village code', 'income is above']) if (!log.includes(text)) fail(`the site's message was not passed on: ${text}`)
  }
  await context.close()
  return `${seen.length} turns, reference ${reference}${sc.voice ? `, ${calls.listen} spoken replies, ${calls.speak} spoken questions` : ''}`
}

async function viaWebsite(context, page, B, lang) {
  const ui = (await (await fetch(`${B}/api/content/${lang}`)).json()).ui
  await page.goto(`${B}/`)
  await page.click(`button:has-text("${lang === 'ta' ? 'தமிழ்' : 'English'}")`)
  await page.click(`button:has-text("${ui.start}")`)
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150)
    if (await page.locator(`button:has-text("${ui.see_results}")`).count()) break
    if (await page.locator('select').count()) {
      await page.selectOption('select', 'madurai')
      await page.click(`button:has-text("${ui.next}")`)
    } else if (await page.locator('input[inputmode=numeric]').count()) {
      await page.fill('input[inputmode=numeric]', '58')
      await page.click(`button:has-text("${ui.next}")`)
    } else {
      await page.locator('button[aria-pressed]').first().click()
    }
  }
  await page.click(`button:has-text("${ui.see_results}")`)
  const button = page.locator('[data-scheme="destitute-widow-pension"] button[data-form]')
  await button.waitFor({ timeout: 10000 })
  const [tab] = await Promise.all([context.waitForEvent('page'), button.click()])
  await tab.waitForURL('**/portal/pension/apply', { timeout: 10000 })
  return tab
}

const SCENARIOS = [
  { name: 'Portal · English · tap and type · desktop · no key', server: 'nokey', lang: 'en', entry: 'handoff' },
  { name: 'Portal · English · phone screen · no key', server: 'nokey', lang: 'en', entry: 'handoff', phone: true },
  { name: 'Portal · Tamil · by voice (fake microphone, Sarvam stand-in)', server: 'fakevoice', lang: 'ta', entry: 'handoff', voice: true },
  { name: 'Portal · Tamil · no handoff ("Fill by voice") · no key', server: 'nokey', lang: 'ta', entry: 'launcher' },
  { name: 'Website → results → Fill button → portal · Tamil · no key', server: 'nokey', lang: 'ta', entry: 'website' },
  { name: 'Site with checks the widget does not know · English · no key', server: 'nokey', lang: 'en', entry: 'fixture' },
]

async function main() {
  const only = process.argv.slice(2).map(Number).filter(Boolean)
  const chosen = SCENARIOS.map((s, i) => ({ ...s, n: i + 1 })).filter((s) => !only.length || only.includes(s.n))
  const port = 8700 + Math.floor(Math.random() * 200)
  const servers = {}
  for (const mode of new Set(chosen.map((s) => s.server))) servers[mode] = startServer(mode, mode === 'nokey' ? port : port + 1)
  try {
    await Promise.all(Object.values(servers).map((s) => waitFor(s.base)))
    if (!fs.existsSync(path.join(frontendDist, 'index.html')) && chosen.some((s) => s.entry === 'website')) fail('build the website first: cd frontend && npm run build')
    const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })
    let failed = 0
    for (const sc of chosen) {
      try {
        const summary = await scenario(browser, servers[sc.server], sc)
        console.log(`✓ ${sc.n}. ${sc.name} — ${summary}`)
      } catch (e) {
        failed++
        console.log(`✗ ${sc.n}. ${sc.name}\n    ${e.message}`)
      }
    }
    await browser.close()
    return failed
  } finally {
    for (const s of Object.values(servers)) s.proc.kill()
  }
}

main().then((failed) => process.exit(failed ? 1 : 0), (e) => { console.error(e); process.exit(1) })
