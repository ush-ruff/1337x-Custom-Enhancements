// ==UserScript==
// @name         1337x - Custom Enhancements
// @namespace    Violentmonkey Scripts
// @match        https://1337x.to/*
// @version      1.0.0
// @author       ushruff
// @description  Setup custom keyboard shortcuts for 1337x.to
// @homepageURL  https://github.com/ush-ruff/1337x-Custom-Enhancements/
// @downloadURL  https://github.com/ush-ruff/1337x-Custom-Enhancements/raw/main/script.user.js
// @grant        none
// @license      GNU GPLv3
// @require      https://raw.githubusercontent.com/ush-ruff/Common/refs/heads/main/Userscript-Helper-Lib/helpersLib.js
// ==/UserScript==

// -----------------------
// CONFIGURABLE VARIABLES
// -----------------------
const KEYS = {
  "F": {
    action: () => focusSelectElement(`.ui-autocomplete-input[type="search"]`),
    label: "Search",
  },
  "A": {
    action: () => sortFilter({category: 'Anime', side: 'left'}),
    label: "Filter by Anime",
  },
  "S": {
    action: () => sortFilter({category: 'TV', side: 'left'}),
    label: "Filter by TV",
  },
  "D": {
    action: () => sortFilter({category: 'Movies', side: 'left'}),
    label: "Filter by Movies",
  },
  "Shift + F": {
    action: () => sortFilter({category: 'size', sortOrder: 'desc'}),
    label: "Sort by size (descending)",
  },
  "Shift + G": {
    action: () => sortFilter({category: 'size', sortOrder: 'asc'}),
    label: "Sort by size (ascending)",
  },
  "Shift + T": {
    action: () => sortFilter({category: 'time', sortOrder: 'desc'}),
    label: "Sort by time (descending)",
  },
  "Shift + ?": {
    action: () => showShortcutInfo(MODAL_ID),
    label: "Show shortcut help",
  },
}

const MODAL_ID = "shortcut-modal"
const SHORTCUT_TOOLTIP = ` Press "?" to view shortcut keys.`


// --------------------
// REFERENCE VARIABLES
// --------------------
const { installKeyHandler, setupShortcutInfo, showShortcutInfo, focusSelectElement } = window.ushruffUSKit

const SELECTORS = {
  allTables: ".table-list-wrap",  // for pages with multiple tables e.g. https://1337x.to/home/
  isSeries: "/series/",           // for pages with tables that have no header e.g. https://1337x.to/series/a-to-z/1/13/
  headerCells: `.table-list > thead > tr:not(.blank) > th:nth-child(1), .table-list > tbody > tr:not(.blank) > td:nth-child(1)`,
  newCells: `.table-list > thead > tr:not(.blank) > th:nth-child(2), .table-list > tbody > tr:not(.blank) > td:nth-child(2)`,
  linkMagnet: 'a[href^="magnet:"]',
  linkDL: '.dropdown-menu > li > a',
}

const DEFINED_NAMES = {
  columnTitle: "ml&nbsp;dl",
  btnMagnet: "list-button-magnet",
  btnDL: "list-button-dl",
  typeMagnet: "ml",
  typeDL: "dl",
}

const CELL_INNER_HTML = (href) =>  `
    <a class=${DEFINED_NAMES.btnMagnet} data-href="${href}" href="javascript:void(0)" title="Magnet">
      <i class="flaticon-magnet"></i>
    </a>
    <a class=${DEFINED_NAMES.btnDL} data-href="${href}" href="javascript:void(0)" title="Direct Download">
      <i class="flaticon-torrent-download"></i>
    </a>
  `


// -------------------------------------------
// Event Listeners
// -------------------------------------------
// console.log("lib version:", window.ushruffUSKit?.version)

window.addEventListener("load", () => {
  installKeyHandler(KEYS)
  setupShortcutInfo(MODAL_ID, KEYS)
  addStyle()
  createColumn()
})


// -------------------------------------------
// Main Functions
// -------------------------------------------
function createColumn() {
  appendColumn()
  addClickListeners(document.querySelectorAll(`.${DEFINED_NAMES.btnMagnet}`), DEFINED_NAMES.typeMagnet)
  addClickListeners(document.querySelectorAll(`.${DEFINED_NAMES.btnDL}`), DEFINED_NAMES.typeDL)
}


// -------------------------------------------
// Helper Functions
// -------------------------------------------
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

    // Try full match: category and sort order
    match = options.find(option => {
      const parts = parseRawValue(option)
      return (parts?.type === 'sort' && parts.sortBy === lowerCategory && parts.sortOrder === lowerSortOrder)
    })

    // Fallback: match category and insert the requested order
    if (!match) {
      const fallback = options.find(option => {
        const parts = parseRawValue(option)
        return (parts?.type === 'sort' && parts.sortBy === lowerCategory)
      })

      if (fallback) {
        const parts = parseRawValue(fallback)
        parts.rawValue[parts.sortOrderIndex] = lowerSortOrder
        fallback.setAttribute('data-raw-value', parts.rawValue.join('/'))
        match = fallback
      }
    }
  }

  // For filtering
  else if (side === 'left') {
    if (options[0].classList.contains('selected') && options[0].textContent.toLowerCase() === lowerCategory) {
      return console.info(`${category} category already selected.`)
    }

    match = options.find(option => {
      const parts = parseRawValue(option)
      return (parts?.type === 'filter' && parts.category === lowerCategory)
    })
  }

  // Check if sort/filter option was returned
  if (!match) return console.warn(`No ${category} found under ${side === 'right' ? 'sorting' : 'filtering'} options.`)

  // Update the URL and reload the page
  const url = new URL(window.location.href)
  url.pathname = match.dataset.rawValue
  window.location.href = url.href
}

function parseRawValue(element) {
  const rawValue = element?.getAttribute('data-raw-value')
  if (!rawValue) return null

  const parts = rawValue.split('/')

  // Handle sorting
  if (parts.length > 6 && parts[1] === 'sort-search') {
    return {
      type: 'sort',
      sortBy: parts[3]?.toLowerCase(),
      sortOrder: parts[4],
      sortOrderIndex: 4,
      rawValue: parts,
    }
  }
  else if (parts.length > 6 && parts[1] === 'sort-category-search') {
    return {
      type: 'sort',
      sortBy: parts[4]?.toLowerCase(),
      sortOrder: parts[5],
      sortOrderIndex: 5,
      rawValue: parts,
    }
  }

  // Handle filtering
  else if (parts.length > 3 && parts[1] === 'category-search') {
    return {
      type: 'filter',
      category: parts[3]?.toLowerCase(),
    }
  }

  return null
}

function appendColumn() {
  const allTables = document.querySelectorAll(SELECTORS.allTables)         // for pages with multiple tables e.g. https://1337x.to/home/
	const isSeries = window.location.href.includes(SELECTORS.isSeries)       // for pages with tables that have no header e.g. https://1337x.to/series/a-to-z/1/13/

  allTables.forEach((table) => {
    const headerCells = table.querySelectorAll(SELECTORS.headerCells)

    headerCells.forEach((cell, index) => {
      if (index === 0 && !isSeries) {
        cell.insertAdjacentHTML('afterend', `<th>${DEFINED_NAMES.columnTitle}</th>`)
      }
      else {
        cell.insertAdjacentHTML('afterend', `<td>${DEFINED_NAMES.columnTitle}</td>`)
      }
    })

    const newCells = table.querySelectorAll(SELECTORS.newCells)

    newCells.forEach((cell, index) => {
      cell.classList.add('coll-1b')

      if (index === 0 && !isSeries) {
        cell.innerHTML = DEFINED_NAMES.columnTitle
      }
      else {
        cell.classList.add('dl-buttons')

        const originalCell = headerCells[index]
        const linkElement = isSeries ? originalCell?.firstElementChild : originalCell?.firstElementChild?.nextElementSibling

        const href = linkElement?.href?.trim() || '#'

        cell.innerHTML = CELL_INNER_HTML(href)
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

        const link = (type === DEFINED_NAMES.typeMagnet) ? tempDoc.querySelector(SELECTORS.linkMagnet) : tempDoc.querySelector(SELECTORS.linkDL)

        if (link) {
          const finalHref = link.href.replace(/^http:/, 'https:')
          window.location.href = finalHref
        }
        else {
          alert(`No ${type === DEFINED_NAMES.typeMagnet ? 'magnet' : 'direct download'} link found.`)
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
    /* Table Styles */
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

    .${DEFINED_NAMES.btnMagnet} > i.flaticon-magnet {
      font-size: 13px;
      color: #da3a04
    }

    .${DEFINED_NAMES.btnDL} > i.flaticon-torrent-download {
      font-size: 13px;
      color: #89ad19;
    }

    /* Add shortcut key tooltip to page. */
    .top-bar > .container {
      position: relative;
    }

    .top-bar > .container:has(.top-bar-nav:first-child)::before {
      content: '${SHORTCUT_TOOLTIP}';
      position: absolute;
      top: -3px;
      left: 15px;
      font-size: 0.85rem;
      font-style: italic;
    }
  `
  document.head.append(styleSheet)
}
