function iterateDropdowns(setChanged) {
  let dropdowns = Array.from(document.querySelectorAll('.customDropdown'))
  dropdowns.forEach(dropdown => {
    let span = $('span', dropdown)
    let select = $('select', dropdown)

    function setSelected() {
      let selected = select.options[select.selectedIndex].value
      span.textContent = selected
    }

    setSelected()
    if (setChanged) select.on('change', setSelected)
  })
}

$.ready(() => {
  iterateDropdowns(true)
})

setTimeout(iterateDropdowns, 100)
