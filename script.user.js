// ==UserScript==
// @name         1337x - Custom Enhancement
// @namespace    Violentmonkey Scripts
// @match        https://1337x.to/*
// @version      0.1.1
// @author       ushruff
// @description  Setup custom keyboard shortcuts for 1337x.to
// @homepageURL  https://github.com/ush-ruff/1337x-Custom-Enhancements/
// @downloadURL  https://github.com/ush-ruff/1337x-Custom-Enhancements/raw/main/script.user.js
// @grant        none
// ==/UserScript==

const KEYS = {
  70:         () => focusSelectElement(`.ui-autocomplete-input[type="search"]`),        // key: F
  65:         () => sortFilter({category: 'TV', side: 'left'}),                         // key: A
  68:         () => sortFilter({category: 'Movies', side: 'left'}),                     // key: S
  'shift+70': () => sortFilter({category: 'size', sortOrder: 'desc'}),                  // key: Shift + F
  'shift+71': () => sortFilter({category: 'size', sortOrder: 'asc'}),                   // key: Shift + G
}


// -------------------------------------------
// Event Listeners
// -------------------------------------------
window.addEventListener("load", createColumn)
document.addEventListener("keyup", pressKey)


// -------------------------------------------
// Main Functions
// -------------------------------------------
function pressKey(e) {
  let key = e.keyCode

  if (e.ctrlKey) key = `ctrl+${key}`
  if (e.shiftKey) key = `shift+${key}`
  if (e.altKey) key = `alt+${key}`

  if (e.target.tagName == "INPUT" || e.target.tagName == "TEXTAREA") return

  if (key in KEYS) {
    return KEYS[key]()
  }
}

function createColumn() {
  addStyle()
  appendColumn()
  addClickListeners(document.querySelectorAll('.list-button-magnet'), 'ml')
  addClickListeners(document.querySelectorAll('.list-button-dl'), 'dl')
}


// -------------------------------------------
// Helper Functions
// -------------------------------------------
function focusSelectElement(element) {
  const el = document.querySelector(element)

  if (el !== null) {
    el.focus()
    el.select()
  }
}

function sortFilter({ category, sortOrder = null, side = 'right' }) {
  const selector = `.box-info-${side}.sort-by-box .options li`
  const options = Array.from(document.querySelectorAll(selector))
  if (options.length === 0) return console.warn(`No options found for ${side === 'right' ? 'sorting' : 'filtering'}.`)

  const lowerCategory = category.toLowerCase()
  const lowerSortOrder = sortOrder?.toLowerCase()
  let match = false

  // For sorting
  if (side === 'right') {
    const currentText = options[0].textContent.toLowerCase()
    if (currentText.includes(lowerCategory) && currentText.includes(lowerSortOrder)) {
      return console.info(`List already sorted for ${category} as ${lowerSortOrder === 'desc' ? 'descending' : 'ascending'}.`)
    }

    match = options.find(option => option.dataset.rawValue.toLowerCase().includes(lowerCategory))

    if (!match.dataset.rawValue.includes(lowerSortOrder)) {
      const replaceStr = lowerSortOrder === 'desc' ? 'asc' : 'desc'
      let updatedValue = match.dataset.rawValue.replace(replaceStr, lowerSortOrder)
      match.dataset.rawValue = updatedValue
    }
  }
  // For filtering
  else if (side === 'left') {
    if (options[0].classList.contains('selected') && options[0].textContent.toLowerCase() === lowerCategory) {
      return console.info(`${category} category already selected.`)
    }

    match = options.find(option => option.dataset.rawValue.toLowerCase().includes(lowerCategory))
  }

  if (!match) return console.warn(`No ${category} found under ${side === 'right' ? 'sorting' : 'filtering'} options.`)

  // Update the URL and reload the page
  const url = new URL(window.location.href)
  url.pathname = match.dataset.rawValue
  window.location.href = url.href
}

function appendColumn() {
  const allTables = document.querySelectorAll('.table-list-wrap')  // for pages with multiple tables e.g. https://1337x.to/home/
	const isSeries = window.location.href.includes('/series/')       // for pages with tables that have no header e.g. https://1337x.to/series/a-to-z/1/13/
  const title = 'ml&nbsp;dl'

  allTables.forEach((table) => {
    const headerCells = table.querySelectorAll(`.table-list > thead > tr:not(.blank) > th:nth-child(1), .table-list > tbody > tr:not(.blank) > td:nth-child(1)`)

    headerCells.forEach((cell, index) => {
      if (index === 0 && !isSeries) {
        cell.insertAdjacentHTML('afterend', `<th>${title}</th>`)
      }
      else {
        cell.insertAdjacentHTML('afterend', `<td>${title}</td>`)
      }
    })

    const newCells = table.querySelectorAll(`.table-list > thead > tr:not(.blank) > th:nth-child(2), .table-list > tbody > tr:not(.blank) > td:nth-child(2)`)

    newCells.forEach((cell, index) => {
      cell.classList.add('coll-1b')

      if (index === 0 && !isSeries) {
        cell.innerHTML = title
      }
      else {
        cell.classList.add('dl-buttons')

        const originalCell = headerCells[index]
        let linkElement = isSeries ? originalCell?.firstElementChild : originalCell?.firstElementChild?.nextElementSibling

        const href = linkElement?.href?.trim() || '#'

        cell.innerHTML = `
          <a class="list-button-magnet" data-href="${href}" href="javascript:void(0)" title="Magnet">
            <i class="flaticon-magnet"></i>
          </a>
          <a class="list-button-dl" data-href="${href}" href="javascript:void(0)" title="Direct Download">
            <i class="flaticon-torrent-download"></i>
          </a>
        `;
      }
    })
  })
}

function addClickListeners(buttons, type) {
  buttons.forEach((button) => {
    button.addEventListener('click', async function () {
      const targetUrl = this.getAttribute('data-href')

      document.body.style.cursor = 'progress' // Show loading spinner on mouse cursor

      try {
        const response = await fetch(targetUrl)
        const text = await response.text()

        const tempDoc = document.implementation.createHTMLDocument().documentElement
        tempDoc.innerHTML = text

        const link = (type === 'ml') ? tempDoc.querySelector('a[href^="magnet:"]') : tempDoc.querySelector('.dropdown-menu > li > a')

        if (link) {
          const finalHref = link.href.replace(/^http:/, 'https:')
          window.location.href = finalHref
        }
        else {
          alert(`No ${type === 'ml' ? 'magnet' : 'direct download'} link found.`)
        }
      }
      catch (err) {
        console.error(`Failed to fetch ${type} link:`, err)
      }
      finally {
        document.body.style.cursor = 'auto' // Restore cursor
      }
    })
  })
}

function addStyle() {
  const styleSheet = document.createElement("style")
  styleSheet.textContent = `
    main.container, div.container {
      max-width: 1600px;
    }

    .table-list > thead > tr > :nth-child(2) {
      text-align: center;
    }

    table.table-list td.name {
      border-right-color: #c0c0c0;
    }

    table.table-list td.dl-buttons {
      position: relative;
      display: flex;
      justify-content: center;
      gap: 0.45rem;
      border-left: 1px solid #f6f6f6;
      border-right: 1px solid #c0c0c0;
    }

    .list-button-magnet > i.flaticon-magnet {
      font-size: 13px;
      color: #da3a04
    }

    .list-button-dl > i.flaticon-torrent-download {
      font-size: 13px;
      color: #89ad19;
    }
  `
  document.head.append(styleSheet)
}
