import { beforeEach, describe, expect, it } from 'vitest'
import { fillText, isEmpty } from '../../src/dom/act'
import { alertsSince, emptyRequired, errorTextNear, fieldProblem, fieldsWithErrors, takeInvalid, waitForFieldProblem, watchAlerts, watchInvalid } from '../../src/dom/errors'

beforeEach(() => {
  document.body.innerHTML = `
    <div class="form-group"><label for="ration">Ration card</label><input id="ration" pattern="[A-Z]{2}[0-9]{6}"></div>
    <div><label for="vc">Village code</label><input id="vc" aria-describedby="vc-help vc-err"><small id="vc-help">From the panchayat</small><span id="vc-err" hidden></span></div>
    <div class="form-group"><label for="fam">Family members</label><input id="fam"></div>
    <div class="form-group"><label for="father">Father's name</label><input id="father" required></div>
    <div class="form-group"><label for="opt">Optional</label><input id="opt"></div>`
})

describe('site problems we did not know about in advance', () => {
  it("reads the browser's own pattern check", () => {
    const el = document.getElementById('ration') as HTMLInputElement
    const since = Date.now()
    fillText(el, 'ab 123')
    expect(fieldProblem(el, '', since)).toBeTruthy()
    fillText(el, 'TN123456')
    expect(fieldProblem(el, '', since)).toBeNull()
  })
  it('reads aria-invalid messages, only once they are shown, and waits for late ones', async () => {
    const el = document.getElementById('vc') as HTMLInputElement
    const since = Date.now()
    expect(errorTextNear(el)).toBe('')
    setTimeout(() => {
      el.setAttribute('aria-invalid', 'true')
      const err = document.getElementById('vc-err')!
      err.hidden = false
      err.textContent = 'Unknown village code'
    }, 300)
    expect(await waitForFieldProblem(el, '', since, 1000)).toContain('Unknown village code')
  })
  it('records alert pop-ups the site shows', () => {
    window.alert = () => undefined
    watchAlerts()
    const since = Date.now()
    const el = document.getElementById('fam') as HTMLInputElement
    el.addEventListener('blur', () => { if (+el.value > 20) window.alert('Family members cannot exceed 20') })
    fillText(el, '25')
    expect(alertsSince(since)).toEqual(['Family members cannot exceed 20'])
    expect(fieldProblem(el, '', since)).toBe('Family members cannot exceed 20')
  })
  it('hears the browser refusing to send a form', () => {
    watchInvalid()
    const el = document.getElementById('father') as HTMLInputElement
    el.dispatchEvent(new Event('invalid'))
    const found = takeInvalid()
    expect(found).toHaveLength(1)
    expect(found[0].el).toBe(el)
  })
  it('finds required boxes that are still empty, and fields showing errors', () => {
    expect(emptyRequired(isEmpty).map((e) => e.id)).toEqual(['father'])
    document.querySelector('#father')!.insertAdjacentHTML('afterend', `<span class="error">Enter the father's name</span>`)
    expect(fieldsWithErrors().map((p) => p.el?.id)).toEqual(['father'])
  })
})
