// ==UserScript==
// @name         1337x - Custom Enhancement
// @namespace    Violentmonkey Scripts
// @match        https://1337x.to/*
// @version      0.4.1
// @author       ushruff
// @description  Setup custom keyboard shortcuts for 1337x.to
// @homepageURL  https://github.com/ush-ruff/1337x-Custom-Enhancements/
// @downloadURL  https://github.com/ush-ruff/1337x-Custom-Enhancements/raw/main/script.user.js
// @grant        none
// @license     GNU GPLv3
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
    action: () => showShortcuts(),
    label: "Show shortcut help",
  },
}

const MODAL_ID = "shortcut-modal"
const SHORTCUT_TOOLTIP = ` Press "?" to view shortcut keys.`


// --------------------
// REFERENCE VARIABLES
// --------------------
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
window.addEventListener("load", () => {
  addStyle()
  createColumn()
  setupShortcutInfo()
})

document.addEventListener("keyup", pressKey)



// -------------------------------------------
// Main Functions
// -------------------------------------------
function pressKey(e) {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return

  const keyName = normalizeKey(e)
  if (KEYS[keyName]) {
    e.preventDefault()
    KEYS[keyName].action()
  }
}

function createColumn() {
  appendColumn()
  addClickListeners(document.querySelectorAll(`.${DEFINED_NAMES.btnMagnet}`), DEFINED_NAMES.typeMagnet)
  addClickListeners(document.querySelectorAll(`.${DEFINED_NAMES.btnDL}`), DEFINED_NAMES.typeDL)
}

function setupShortcutInfo() {
  insertModalHTML()

  const shortcutModal = document.querySelector(`#${MODAL_ID}`)
  const closeBtn = shortcutModal.querySelector(`.${MODAL_ID}-close`)
  closeBtn.addEventListener("click", () => {shortcutModal.close()})

  window.addEventListener("click", (event) => {
    if (event.target === shortcutModal) shortcutModal.close()
  })
}


// -------------------------------------------
// Helper Functions
// -------------------------------------------
function normalizeKey(e) {
  const parts = []
  if (e.ctrlKey) parts.push("Ctrl")
  if (e.shiftKey) parts.push("Shift")
  if (e.altKey) parts.push("Alt")

  // Convert key into friendly text
  let keyText = e.key.toUpperCase()
  if (keyText === " ") keyText = "Space"
  if (keyText.length > 1 && !/F\d+/.test(keyText)) {
    // Special named keys (ArrowUp, Escape, etc.)
    keyText = keyText[0].toUpperCase() + keyText.slice(1)
  }

  parts.push(keyText)
  return parts.join(" + ")
}

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

function showShortcuts() {
  const shortcutModal = document.querySelector(`#${MODAL_ID}`)
  shortcutModal.showModal()
}

function insertModalHTML() {
  if (document.getElementById(MODAL_ID)) return

  const modal = document.createElement("dialog")
  modal.id = MODAL_ID

  const modalInner = `
    <div class="${MODAL_ID}-header">
      <h2 class="${MODAL_ID}-title">Shortcut Keys</h2>
      <span class="${MODAL_ID}-close">&times;</span>
    </div>
  `
  modal.innerHTML = modalInner

  const keyList = document.createElement("ul")

  Object.entries(KEYS).forEach(([key, {label}]) => {
    const listItem = document.createElement("li")

    const shortcutInfo = document.createElement("span")
    shortcutInfo.textContent = label
    listItem.appendChild(shortcutInfo)

    const shortcutKey = document.createElement("code")
    shortcutKey.classList.add("shortcut-key")
    shortcutKey.textContent = key
    listItem.appendChild(shortcutKey)

    keyList.appendChild(listItem)
  })

  modal.appendChild(keyList)
  document.body.appendChild(modal)
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

    /* Modal Styles */
    #${MODAL_ID} {
      min-width: 700px;
      padding: 1rem;
      background: #222;
      border: unset;
      border-radius: 0.5rem;
      color: #bbb;
      box-shadow: 0 0 10px 2px rgb(0 0 0 / 0.5);
      outline: none;
    }

    #${MODAL_ID}::backdrop {
      background: rgb(0 0 0 / 0.75);
    }

    .${MODAL_ID}-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #333;
    }

    #${MODAL_ID} .${MODAL_ID}-title {
      font-size: 2rem;
      margin: 0;
      padding: 0.8rem;
      border: unset;
      color: #e5e5e5;
    }

    .${MODAL_ID}-close {
      font-size: 2.4rem;
      padding-inline: 0.8rem;
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
    }

    .${MODAL_ID}-close:is(:hover, :focus) {
      border: none;
      color: #f9f2f4;
    }

    #${MODAL_ID} ul {
      margin: 0.8rem 2rem 0;
      padding: 0;
    }

    #${MODAL_ID} li {
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8rem;
      padding-block: 0.75rem;
    }

    #${MODAL_ID} li:not(:last-child) {
      border-bottom: 1px solid #333;
    }

    .shortcut-key {
      min-width: 120px;
      text-align: center;
      line-height: 2;
      background: #333;
      border-radius: 0.2rem;
      color: #f9f2f4;
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
