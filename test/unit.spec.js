import expect from 'expect'
import { jsdom } from 'jsdom'
import jquery from 'jquery'

describe('Autocomplete', () => {
  let $

  before(() => {
    const html = '<html><body><input type="text" id="autocomplete"></body></html>'
    global.document = jsdom(html)
    global.window = global.document.defaultView
    $ = jquery(global.window)
    global.jQuery = $

    require('../src/autocomplete') // eslint-disable-line global-require
  })

  describe('Lookup', () => {
    let $element
    let instance

    before(() => {
      const lookup = [
        { value: 'JavaScript', data: 'javascript' },
        { value: 'Java', data: 'java' },
        { value: 'PHP', data: 'php' },
      ]

      $element = $('#autocomplete')

      $element.autocomplete({
        lookup,
      })

      instance = $element.autocomplete()
    })

    it('should create instance', (done) => {
      expect(typeof instance).toBe('object')
      done()
    })

    it('should transform results', (done) => {
      $element.val('j')
      instance.onValueChange()

      expect(instance.suggestions.length).toBe(2)
      expect(instance.suggestions[0].value).toBe('JavaScript')

      done()
    })

    it('should set options', (done) => {
      const notice = 'some-notice'
      instance.setOptions({
        noSuggestionNotice: notice,
      })
      expect(instance.options.noSuggestionNotice).toBe(notice)
      done()
    })

    it('should not autoselect first item by default', (done) => {
      $element.val('j')
      instance.onValueChange()

      expect(instance.selectedIndex).toBe(-1)
      done()
    })

    it('should autoselect first item when autoSelectFirst is true', (done) => {
      instance.setOptions({
        autoSelectFirst: true,
      })

      $element.val('j')
      instance.onValueChange()

      expect(instance.selectedIndex).toBe(0)
      done()
    })

    it('should call onSelect', (done) => {
      const options = {
        onSelect: () => {},
      }

      const spy = expect.spyOn(options, 'onSelect')

      instance.setOptions({
        onSelect: options.onSelect,
      })

      $element.val('php')
      instance.onValueChange()

      expect(spy.calls.length).toBe(1)
      expect(spy.calls[0].arguments[0].data).toBe('php')

      done()
    })
  })
})
