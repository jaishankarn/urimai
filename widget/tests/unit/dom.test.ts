import { beforeEach, describe, expect, it } from 'vitest'
import { chooseOption, chooseRadio, fillText, formatDate, isEmpty, optionsOf, Refused, shown } from '../../src/dom/act'
import { hintMatches, labelText } from '../../src/dom/labels'
import { documents, fingerprintMatches, locate } from '../../src/dom/locate'
import { isSensitive } from '../../src/dom/sensitive'
import { errorTextNear, fieldProblem, pageSummary, referenceNumber, emptyRequired, fieldsWithErrors } from '../../src/dom/errors'
import { localUnderstand, spell } from '../../src/talk/local'
import type { PlanField } from '../../src/types'

const field = (find: PlanField['find'], extra: Partial<PlanField> = {}): PlanField => ({
  key: 'f', find, mode: 'fill', kind: 'text', format: null, source: 'ask', value: null, aliases: null, page: '/',
  optional: false, reloads: false, frame: null, label: null, ask: null, say: null, help: null, ...extra,
})

beforeEach(() => {
  document.body.innerHTML = `
    <table>
      <tr><td>Applicant Name (in English capitals) *</td><td><input id="a" name="ApplicantName"></td></tr>
      <tr><td>Village / Ward</td><td><select id="v"><option value="">-- Select --</option><option value="w1">Ward 1</option></select></td></tr>
      <tr><td>Age</td><td><input id="age"></td></tr>
      <tr><td>Aadhaar Number</td><td><input id="uid"><span class="err"></span></td></tr>
      <tr><td>Pin Code</td><td><input id="pincode" maxlength="6"><span class="err">old server message</span></td></tr>
      <tr><td>Gender</td><td><label><input type="radio" name="g" value="F"> Female</label><label><input type="radio" name="g" value="M"> Male</label></td></tr>
    </table>
    <label for="mob">Mobile number</label><input id="mob">
    <input id="only" placeholder="Husband's name">
    <input type="password" id="pw" name="secret">
    <div class="summary">Enter a valid 12-digit Aadhaar number.</div>
    <p>Acknowledgement No: <b>DEMO/2026/004821</b></p>`
})

describe('labels and locating', () => {
  it('reads labels from table rows, label[for] and placeholders', () => {
    expect(labelText(document.getElementById('a')!)).toContain('applicant name (in english capitals)')
    expect(labelText(document.getElementById('mob')!)).toContain('mobile number')
    expect(labelText(document.getElementById('only')!)).toContain("husband's name")
  })
  it('matches latin hints on word boundaries only', () => {
    expect(hintMatches('village / ward', 'age')).toBe(false)
    expect(hintMatches('age', 'age')).toBe(true)
    expect(hintMatches('உங்கள் வயது', 'வயது')).toBe(true)
  })
  it('finds a field by label, preferring the longest hint, and by selector', () => {
    expect(locate(field({ selector: null, labels: ['age'] }))?.id).toBe('age')
    expect(locate(field({ selector: null, labels: ['name', 'applicant name (in english'] }))?.id).toBe('a')
    expect(locate(field({ selector: '#mob', labels: [] }))?.id).toBe('mob')
    expect(locate(field({ selector: null, labels: ['nothing like this'] }))).toBeNull()
  })
  it('counts fingerprint labels', () => {
    expect(fingerprintMatches(['applicant name', 'village', 'date of birth'])).toBe(2)
  })
  it('includes same-origin frames', () => {
    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    frame.contentDocument!.body.innerHTML = '<label for="d">Door No</label><input id="d">'
    expect(documents()).toHaveLength(2)
    expect(locate(field({ selector: null, labels: ['door no'] }))?.ownerDocument).toBe(frame.contentDocument)
  })
})

describe('sensitive fields (R1)', () => {
  it('detects them', () => {
    expect(isSensitive(document.getElementById('uid')!)).toBe(true)
    expect(isSensitive(document.getElementById('pw')!)).toBe(true)
    expect(isSensitive(document.getElementById("pincode")!)).toBe(false)
    expect(isSensitive(document.getElementById('a')!)).toBe(false)
  })
  it('refuses to fill or read them, but allows an emptiness check', () => {
    const uid = document.getElementById('uid') as HTMLInputElement
    expect(() => fillText(uid, '1234')).toThrow(Refused)
    uid.value = '123412341234'
    expect(() => shown(uid)).toThrow(Refused)
    expect(isEmpty(uid)).toBe(false)
  })
})

describe('acting', () => {
  it('fills text so the site sees input and change events', () => {
    const el = document.getElementById('a') as HTMLInputElement
    const seen: string[] = []
    el.addEventListener('input', () => seen.push('input'))
    el.addEventListener('change', () => seen.push('change'))
    expect(fillText(el, 'SELVI')).toBeNull()
    expect(el.value).toBe('SELVI')
    expect(seen).toEqual(['input', 'change'])
  })
  it('respects maxlength', () => {
    expect(fillText(document.getElementById("pincode") as HTMLInputElement, '6250011')).toBe('too_long')
  })
  it('chooses options by text and saves state before the change event', async () => {
    const el = document.getElementById('v') as HTMLSelectElement
    const order: string[] = []
    el.addEventListener('change', () => order.push('change'))
    expect(await chooseOption(el, ['ward 1'], () => order.push('saved'), 0)).toBeNull()
    expect(order).toEqual(['saved', 'change'])
    expect(shown(el)).toBe('Ward 1')
    expect(optionsOf(el)).toEqual(['Ward 1'])
    expect(await chooseOption(el, ['Ward 9'], () => undefined, 0)).toBe('not_in_list')
  })
  it('chooses a radio by its label', () => {
    const el = document.querySelector('input[name=g]') as HTMLInputElement
    expect(chooseRadio(el, ['Male'])).toBeNull()
    expect(shown(el)).toBe('Male')
    expect(optionsOf(el)).toEqual(['Female', 'Male'])
  })
  it('formats dates', () => {
    expect(formatDate('1968-03-14', 'dd/mm/yyyy')).toBe('14/03/1968')
    expect(formatDate('1968-03-14', 'yyyy-mm-dd')).toBe('1968-03-14')
  })
})

describe('verifying', () => {
  it('ignores old server messages and reports new ones', () => {
    const pin = document.getElementById("pincode") as HTMLInputElement
    const before = errorTextNear(pin)
    expect(fieldProblem(pin, before, Date.now())).toBeNull()
    pin.nextElementSibling!.textContent = 'Enter a valid PIN code'
    expect(fieldProblem(pin, before, Date.now())).toBe('Enter a valid PIN code')
  })
  it('reads the page error summary and reference number', () => {
    expect(pageSummary()).toContain('12-digit Aadhaar')
    expect(referenceNumber()).toBe('DEMO/2026/004821')
  })
})

describe('offline understanding', () => {
  it('knows yes, no and done in Tamil and English', () => {
    expect(localUnderstand('confirm', 'ஆமாம்').intent).toBe('yes')
    expect(localUnderstand('confirm', 'illa').intent).toBe('no')
    expect(localUnderstand('done', 'முடிந்தது').intent).toBe('done')
    expect(localUnderstand('value', 'Gandhi Street')).toEqual({ intent: 'value', value: 'Gandhi Street' })
  })
  it('spells names letter by letter', () => {
    expect(spell('SELVI M')).toBe('S E L V I M')
  })
})
