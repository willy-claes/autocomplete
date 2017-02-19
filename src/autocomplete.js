(function ($) { // eslint-disable-line func-names
  const utils = {
    escapeRegExChars: value => (
      value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    ),
    createNode: (containerClass) => {
      const div = document.createElement('div')
      div.className = containerClass
      div.style.position = 'absolute'
      div.style.display = 'none'
      return div
    },
  }

  const formatResult = (suggestion, currentValue) => {
    // Do not replace anything if there current value is empty.
    if (!currentValue) {
      return suggestion.value
    }

    const pattern = `(${utils.escapeRegExChars(currentValue)})`

    return suggestion.value
      .replace(new RegExp(pattern, 'gi'), '<strong>$1<\/strong>') // eslint-disable-line no-useless-escape
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/&lt;(\/?strong)&gt;/g, '<$1>')
  }

  const lookupFilter = (suggestion, originalQuery, queryLowerCase) => (
    suggestion.value.toLowerCase().indexOf(queryLowerCase) !== -1
  )

  const keys = {
    ESC: 27,
    TAB: 9,
    RETURN: 13,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
  }

  function Autocomplete(el, options) {
    const defaults = {
      autoSelectFirst: false,
      appendTo: document.body,
      lookup: null,
      onSelect: null,
      width: 'auto',
      minChars: 1,
      maxHeight: 300,
      formatResult,
      zIndex: 9999,
      preserveInput: false,
      containerClass: 'autocomplete-suggestions',
      tabDisabled: false,
      triggerSelectOnValidInput: true,
      lookupFilter,
      showNoSuggestionNotice: false,
      noSuggestionNotice: 'No results',
      orientation: 'bottom',
      forceFixPosition: false,
    }

    // Shared variables:
    this.element = el
    this.el = $(el)
    this.suggestions = []
    this.selectedIndex = -1
    this.currentValue = this.element.value
    this.intervalId = 0
    this.isLocal = false
    this.suggestionsContainer = null
    this.noSuggestionsContainer = null
    this.options = $.extend({}, defaults, options)
    this.classes = {
      selected: 'autocomplete-selected',
      suggestion: 'autocomplete-suggestion',
    }
    this.hint = null
    this.hintValue = ''
    this.selection = null

    // Initialize and set options:
    this.initialize()
    this.setOptions(options)
  }

  Autocomplete.prototype = {

    initialize() {
      const suggestionSelector = `.${this.classes.suggestion}`

      // Remove autocomplete attribute to prevent native suggestions.
      this.element.setAttribute('autocomplete', 'off')

      // html() deals with many types: htmlString or Element or Array or jQuery.
      this.noSuggestionsContainer = $('<div class="autocomplete-no-suggestion"></div>')
                                    .html(this.options.noSuggestionNotice).get(0)

      this.suggestionsContainer = utils.createNode(this.options.containerClass)

      const container = $(this.suggestionsContainer)

      container.appendTo(this.options.appendTo)

      // Only set width if it was provided.
      if (this.options.width !== 'auto') {
        container.css('width', this.options.width)
      }

      // Listen for mouse over event on suggestions list.
      const that = this
      container.on('mouseover.autocomplete', suggestionSelector, function onMouseOver() {
        that.activate($(this).data('index'))
      })

      // Deselect active element when mouse leaves suggestions container.
      container.on('mouseout.autocomplete', () => {
        this.selectedIndex = -1
        container.children(`.${this.classes.selected}`).removeClass(this.classes.selected)
      })

      // Listen for click event on suggestions list.
      container.on('click.autocomplete', suggestionSelector, function onClick() {
        that.select($(this).data('index'))
        return false
      })

      this.fixPositionCapture = () => {
        if (this.visible) {
          this.fixPosition()
        }
      }

      $(window).on('resize.autocomplete', this.fixPositionCapture)

      this.el.on('keydown.autocomplete', (e) => { this.onKeyPress(e) })
      this.el.on('keyup.autocomplete', (e) => { this.onKeyUp(e) })
      this.el.on('blur.autocomplete', () => { this.onBlur() })
      this.el.on('focus.autocomplete', () => { this.onFocus() })
      this.el.on('change.autocomplete', (e) => { this.onKeyUp(e) })
      this.el.on('input.autocomplete', (e) => { this.onKeyUp(e) })
    },

    killerFn(e) {
      if (!$(e.target).closest(`.${this.options.containerClass}`).length) {
        this.killSuggestions()
        this.disableKillerFn()
      }
    },

    onFocus() {
      this.fixPosition()
      if (this.el.val().length >= this.options.minChars) {
        this.onValueChange()
      }
    },

    onBlur() {
      this.enableKillerFn()
    },

    setOptions(suppliedOptions) {
      const options = this.options

      $.extend(options, suppliedOptions)

      this.isLocal = $.isArray(options.lookup)

      if (this.isLocal) {
        options.lookup = this.verifySuggestionsFormat(options.lookup)
      }

      options.orientation = this.validateOrientation(options.orientation, 'bottom')

      // Adjust height, width and z-index.
      $(this.suggestionsContainer).css({
        'max-height': `${options.maxHeight}px`,
        width: `${options.width}px`,
        'z-index': options.zIndex,
      })
    },

    clear() {
      this.currentValue = ''
      this.suggestions = []
    },

    disable() {
      this.disabled = true
    },

    enable() {
      this.disabled = false
    },

    fixPosition() {
      // Use only when container has already its content.
      const $container = $(this.suggestionsContainer)
      const containerParent = $container.parent().get(0)

      // Fix position automatically when appended to body.
      // In other cases force parameter must be given.
      if (containerParent !== document.body && !this.options.forceFixPosition) {
        return
      }

      // Choose orientation
      let orientation = this.options.orientation
      const containerHeight = $container.outerHeight()
      const height = this.el.outerHeight()
      const offset = this.el.offset()
      const styles = {
        top: offset.top,
        left: offset.left,
      }

      if (orientation === 'auto') {
        const viewPortHeight = $(window).height()
        const scrollTop = $(window).scrollTop()
        const topOverflow = -scrollTop + offset.top - containerHeight
        const bottomOverflow = scrollTop + viewPortHeight - (offset.top + height + containerHeight)

        orientation = (Math.max(topOverflow, bottomOverflow) === topOverflow) ? 'top' : 'bottom'
      }

      if (orientation === 'top') {
        styles.top += -containerHeight
      } else {
        styles.top += height
      }

      // If container is not positioned to body,
      // correct its position using offset parent offset.
      if (containerParent !== document.body) {
        const opacity = $container.css('opacity')

        if (!this.visible) {
          $container.css('opacity', 0).show()
        }

        const parentOffsetDiff = $container.offsetParent().offset()
        styles.top -= parentOffsetDiff.top
        styles.left -= parentOffsetDiff.left

        if (!this.visible) {
          $container.css('opacity', opacity).hide()
        }
      }

      if (this.options.width === 'auto') {
        styles.width = `${this.el.outerWidth()}px`
      }

      $container.css(styles)
    },

    enableKillerFn() {
      $(document).on('click.autocomplete', this.killerFn)
    },

    disableKillerFn() {
      $(document).off('click.autocomplete', this.killerFn)
    },

    killSuggestions() {
      this.stopKillSuggestions()
      this.intervalId = window.setInterval(() => {
        if (this.visible) {
          // No need to restore value when  preserveInput === true,
          // because we did not change it
          if (!this.options.preserveInput) {
            this.el.val(this.currentValue)
          }
          this.hide()
        }
        this.stopKillSuggestions()
      }, 50)
    },

    stopKillSuggestions() {
      window.clearInterval(this.intervalId)
    },

    isCursorAtEnd() {
      const valLength = this.el.val().length
      const selectionStart = this.element.selectionStart

      if (typeof selectionStart === 'number') {
        return selectionStart === valLength
      }
      if (document.selection) {
        const range = document.selection.createRange()
        range.moveStart('character', -valLength)
        return valLength === range.text.length
      }
      return true
    },

    onKeyPress(e) {
      // If suggestions are hidden and user presses arrow down, display suggestions:
      if (!this.disabled && !this.visible && e.which === keys.DOWN && this.currentValue) {
        this.suggest()
        return
      }

      if (this.disabled || !this.visible) {
        return
      }

      switch (e.which) {
        case keys.ESC:
          this.el.val(this.currentValue)
          this.hide()
          break
        case keys.RIGHT:
          if (this.hint && this.options.onHint && this.isCursorAtEnd()) {
            this.selectHint()
            break
          }
          return
        case keys.TAB:
          if (this.hint && this.options.onHint) {
            this.selectHint()
            return
          }
          if (this.selectedIndex === -1) {
            this.hide()
            return
          }
          this.select(this.selectedIndex)
          if (this.options.tabDisabled === false) {
            return
          }
          break
        case keys.RETURN:
          if (this.selectedIndex === -1) {
            this.hide()
            return
          }
          this.select(this.selectedIndex)
          break
        case keys.UP:
          this.moveUp()
          break
        case keys.DOWN:
          this.moveDown()
          break
        default:
          return
      }

      // Cancel event if function did not return:
      e.stopImmediatePropagation()
      e.preventDefault()
    },

    onKeyUp(e) {
      if (this.disabled) {
        return
      }

      if (e.which === keys.UP || e.which === keys.DOWN) {
        return
      }

      if (this.currentValue !== this.el.val()) {
        this.findBestHint()
        this.onValueChange()
      }
    },

    onValueChange() {
      const options = this.options
      const value = this.el.val()
      const query = value

      if (this.selection && this.currentValue !== query) {
        this.selection = null;
        (options.onInvalidateSelection || $.noop).call(this.element)
      }

      this.currentValue = value
      this.selectedIndex = -1

      // Check existing suggestion for the match before proceeding:
      if (options.triggerSelectOnValidInput && this.isExactMatch(query)) {
        this.select(0)
        return
      }

      if (query.length < options.minChars) {
        this.hide()
      } else {
        this.getSuggestions(query)
      }
    },

    isExactMatch(query) {
      const suggestions = this.suggestions
      return (suggestions.length === 1
        && suggestions[0].value.toLowerCase() === query.toLowerCase())
    },

    getSuggestionsLocal(query) {
      const options = this.options
      const queryLowerCase = query.toLowerCase()
      const filter = options.lookupFilter
      const limit = parseInt(options.lookupLimit, 10)

      const data = {
        suggestions: $.grep(options.lookup, suggestion => (
          filter(suggestion, query, queryLowerCase)
        )),
      }

      if (limit && data.suggestions.length > limit) {
        data.suggestions = data.suggestions.slice(0, limit)
      }

      return data
    },

    getSuggestions(q) {
      const options = this.options

      if ($.isFunction(options.lookup)) {
        options.lookup(q, (data) => {
          this.suggestions = data.suggestions
          this.suggest()
        })
        return
      }

      const response = this.getSuggestionsLocal(q)

      if (response && $.isArray(response.suggestions)) {
        this.suggestions = response.suggestions
        this.suggest()
      }
    },

    hide() {
      const container = $(this.suggestionsContainer)

      if ($.isFunction(this.options.onHide) && this.visible) {
        this.options.onHide.call(this.element, container)
      }

      this.visible = false
      this.selectedIndex = -1
      $(this.suggestionsContainer).hide()
      this.signalHint(null)
    },

    suggest() {
      if (!this.suggestions.length) {
        if (this.options.showNoSuggestionNotice) {
          this.noSuggestions()
        } else {
          this.hide()
        }
        return
      }

      const options = this.options
      const value = this.currentValue
      const className = this.classes.suggestion
      const classSelected = this.classes.selected
      const container = $(this.suggestionsContainer)
      const noSuggestionsContainer = $(this.noSuggestionsContainer)
      const beforeRender = options.beforeRender
      let html = ''

      if (options.triggerSelectOnValidInput && this.isExactMatch(value)) {
        this.select(0)
        return
      }

      // Build suggestions inner HTML.
      $.each(this.suggestions, (i, suggestion) => {
        html += `<div class="${className}" data-index="${i}">${options.formatResult(suggestion, value, i)}</div>`
      })

      this.adjustContainerWidth()

      noSuggestionsContainer.detach()
      container.html(html)

      if ($.isFunction(beforeRender)) {
        beforeRender.call(this.element, container, this.suggestions)
      }

      this.fixPosition()
      container.show()

      // Select first value by default.
      if (options.autoSelectFirst) {
        this.selectedIndex = 0
        container.scrollTop(0)
        container.children(`.${className}`).first().addClass(classSelected)
      }

      this.visible = true
      this.findBestHint()
    },

    noSuggestions() {
      const container = $(this.suggestionsContainer)
      const noSuggestionsContainer = $(this.noSuggestionsContainer)

      this.adjustContainerWidth()

      // Some explicit steps. Be careful here as it easy to get
      // noSuggestionsContainer removed from DOM if not detached properly.
      noSuggestionsContainer.detach()
      container.empty() // clean suggestions if any
      container.append(noSuggestionsContainer)

      this.fixPosition()

      container.show()
      this.visible = true
    },

    adjustContainerWidth() {
      const options = this.options
      const container = $(this.suggestionsContainer)

      // If width is auto, adjust width before displaying suggestions,
      // because if instance was created before input had width, it will be zero.
      // Also it adjusts if input width has changed.
      if (options.width === 'auto') {
        const width = this.el.outerWidth()
        container.css('width', width > 0 ? width : 300)
      } else if (options.width === 'flex') {
        // Trust the source! Unset the width property so it will be the max length
        // the containing elements.
        container.css('width', '')
      }
    },

    findBestHint() {
      const value = this.el.val().toLowerCase()
      let bestMatch = null

      if (!value) {
        return
      }

      $.each(this.suggestions, (i, suggestion) => {
        const foundMatch = suggestion.value.toLowerCase().indexOf(value) === 0
        if (foundMatch) {
          bestMatch = suggestion
        }
        return !foundMatch
      })

      this.signalHint(bestMatch)
    },

    signalHint(suggestion) {
      let hintValue = ''
      if (suggestion) {
        hintValue = this.currentValue + suggestion.value.substr(this.currentValue.length)
      }
      if (this.hintValue !== hintValue) {
        this.hintValue = hintValue
        this.hint = suggestion;
        (this.options.onHint || $.noop)(hintValue)
      }
    },

    verifySuggestionsFormat(suggestions) {
      // If suggestions is string array, convert them to supported format:
      if (suggestions.length && typeof suggestions[0] === 'string') {
        return $.map(suggestions, value => ({
          value,
          data: null,
        }))
      }
      return suggestions
    },

    validateOrientation(orientation, fallback) {
      let ot = $.trim(orientation || '').toLowerCase()
      if ($.inArray(ot, ['auto', 'bottom', 'top']) === -1) {
        ot = fallback
      }
      return ot
    },

    activate(index) {
      const selected = this.classes.selected
      const container = $(this.suggestionsContainer)
      const children = container.find(`.${this.classes.suggestion}`)

      container.find(`.${selected}`).removeClass(selected)

      this.selectedIndex = index

      if (this.selectedIndex !== -1 && children.length > this.selectedIndex) {
        const activeItem = children.get(this.selectedIndex)
        $(activeItem).addClass(selected)
        return activeItem
      }

      return null
    },

    selectHint() {
      const i = $.inArray(this.hint, this.suggestions)
      this.select(i)
    },

    select(i) {
      this.hide()
      this.onSelect(i)
      this.disableKillerFn()
    },

    moveUp() {
      if (this.selectedIndex === -1) {
        return
      }

      if (this.selectedIndex === 0) {
        $(this.suggestionsContainer).children().first().removeClass(this.classes.selected)
        this.selectedIndex = -1
        this.el.val(this.currentValue)
        this.findBestHint()
        return
      }

      this.adjustScroll(this.selectedIndex - 1)
    },

    moveDown() {
      if (this.selectedIndex === (this.suggestions.length - 1)) {
        return
      }

      this.adjustScroll(this.selectedIndex + 1)
    },

    adjustScroll(index) {
      const activeItem = this.activate(index)

      if (!activeItem) {
        return
      }

      const heightDelta = $(activeItem).outerHeight()

      const offsetTop = activeItem.offsetTop
      const upperBound = $(this.suggestionsContainer).scrollTop()
      const lowerBound = upperBound + this.options.maxHeight - heightDelta

      if (offsetTop < upperBound) {
        $(this.suggestionsContainer).scrollTop(offsetTop)
      } else if (offsetTop > lowerBound) {
        $(this.suggestionsContainer).scrollTop(offsetTop - this.options.maxHeight + heightDelta)
      }

      if (!this.options.preserveInput) {
        this.el.val(this.suggestions[index].value)
      }
      this.signalHint(null)
    },

    onSelect(index) {
      const onSelectCallback = this.options.onSelect
      const suggestion = this.suggestions[index]

      this.currentValue = suggestion.value

      if (this.currentValue !== this.el.val() && !this.options.preserveInput) {
        this.el.val(this.currentValue)
      }

      this.signalHint(null)
      this.suggestions = []
      this.selection = suggestion

      if ($.isFunction(onSelectCallback)) {
        onSelectCallback.call(this.element, suggestion)
      }
    },

    dispose() {
      this.el.off('.autocomplete').removeData('autocomplete')
      this.disableKillerFn()
      $(window).off('resize.autocomplete', this.fixPositionCapture)
      $(this.suggestionsContainer).remove()
    },
  }

  // Create chainable jQuery plugin:
  // eslint-disable-next-line no-param-reassign
  $.fn.autocomplete = function autocomplete(options, args) {
    const dataKey = 'autocomplete'
    // If function invoked without argument return instance of the first matched element.
    if (!arguments.length) {
      return this.first().data(dataKey)
    }

    return this.each(function () { // eslint-disable-line func-names
      const inputElement = $(this)
      let instance = inputElement.data(dataKey)

      if (typeof options === 'string') {
        if (instance && typeof instance[options] === 'function') {
          instance[options](args)
        }
      } else {
        // If instance already exists, destroy it.
        if (instance && instance.dispose) {
          instance.dispose()
        }
        instance = new Autocomplete(this, options)
        inputElement.data(dataKey, instance)
      }
    })
  }
}(jQuery))
