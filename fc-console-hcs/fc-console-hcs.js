// ==UserScript==
// @name         FC Console Pick HCs
// @updateURL    https://github.com/samoore036/CF-TamperMonkey-Scripts/blob/main/dwell-callouts/cpt-dwells.js
// @namespace    https://github.com/samoore036/CF-TamperMonkey-Scripts
// @version      1.0
// @description  Display set rates, TURs, and hcs vs actuals to increase visibility of pick hc deviations
// @author       mooshahe
// @match        https://picking-console.na.picking.aft.a2z.com/fc/*/*
// @grant        GM.xmlHttpRequest
// ==/UserScript==

/*ready state changes do not work at all, neither does window/document.loaded. 
fc console is dynamically generated so must wait until it is completely loaded
5 seconds seems to be a safe amount of time to wait to load.
users will be alerted to reach out if they still get the issue of not loading.
*/
setTimeout(loadScript, 5000);

function loadScript() {
    'use strict';

    let fc = document.URL.split('/')[4];
    /*---------------------------/
    -local storage functionality-
    /--------------------------*/
    /*

    initialize localstorage if it has not been created yet
    localstorage keys per site are fc-ce, fc-tso, fc-vrets
    */
    if (localStorage.getItem(`${fc}-ce`) === null) {
        localStorage.setItem(`${fc}-ce`, JSON.stringify([]));
    }
    if (localStorage.getItem(`${fc}-tso`) === null) {
        localStorage.setItem(`${fc}-tso`, JSON.stringify([]));
    }
    if (localStorage.getItem(`${fc}-vrets`) === null) {
        localStorage.setItem(`${fc}-vrets`, JSON.stringify([]));
    }

    function getCePaths() {
        let ceArr = JSON.parse(localStorage.getItem(`${fc}-ce`));

        if (ceArr.includes(',')) {
            const arr = ceArr[0].split(',');
            const trimmedArr = arr.map(path => path.trim());
            //sort array alphabetically, as rodeo displays paths alphabetically (therefore CF planner as well), so that it aligns with planning tools
            return trimmedArr.sort();
        } 

        return ceArr.sort();
    }

    function addCePath(pp) {
        const currentCePaths = getCePaths();
        currentCePaths.push(pp);
        localStorage.setItem(`${fc}-ce`, JSON.stringify(currentCePaths));
    }

    function removeCePath(pp) {
        const currentCePaths = getCePaths();
        for (let i = 0; i < currentCePaths.length; i++) {
            if (currentCePaths[i] === pp) {
                currentCePaths.splice(i, 1);
            }
        }
        localStorage.setItem(`${fc}-ce`, JSON.stringify(currentCePaths));
    }

    function getTsoPaths() {
        let tsoArr = JSON.parse(localStorage.getItem(`${fc}-tso`))
        if (tsoArr.includes(',')) {
            const arr = tsoArr[0].split(',');
            const trimmedArr = arr.map(path => path.trim());
            return trimmedArr.sort();
        } 

        return tsoArr.sort();
    }

    function addTsoPath(pp) {
        const currentTsoPaths = getTsoPaths();
        currentTsoPaths.push(pp);
        localStorage.setItem(`${fc}-tso`, JSON.stringify(currentTsoPaths));
    }

    function removeTsoPath(pp) {
        const currentTsoPaths = getTsoPaths();
        for (let i = 0; i < currentTsoPaths.length; i++) {
            if (currentTsoPaths[i] === pp) {
                currentTsoPaths.splice(i, 1);
            }
        }
        localStorage.setItem(`${fc}-tso`, JSON.stringify(currentTsoPaths));
    }

    function getVretsPaths() {
        let vretsArr = JSON.parse(localStorage.getItem(`${fc}-vrets`))
        if (vretsArr.includes(',')) {
            const arr = vretsArr[0].split(',');
            const trimmedArr = arr.map(path => path.trim());
            console.log('sorting trimmed vrets');
            return trimmedArr.sort();
        } 

        return vretsArr.sort();
    }

    function addVretsPath(pp) {
        const currentVretsPaths = getVretsPaths();
        currentVretsPaths.push(pp);
        localStorage.setItem(`${fc}-vrets`, JSON.stringify(currentVretsPaths));
    }

    function removeVretsPath(pp) {
        const currentVretsPaths = getVretsPaths();
        for (let i = 0; i < currentVretsPaths.length; i++) {
            if (currentVretsPaths[i] === pp) {
                currentVretsPaths.splice(i, 1);
            }
        }
        localStorage.setItem(`${fc}-vrets`, JSON.stringify(currentVretsPaths));
    }

    function isCurrentPath(pp) {
        const cePaths = getCePaths();
        const tsoPaths = getTsoPaths();
        const vretsPaths = getVretsPaths();
        for (let path of cePaths) {
            if (path === pp) {
                return true;
            }
        }
        for (let path of tsoPaths) {
            if (path === pp) {
                return true;
            }
        }
        for (let path of vretsPaths) {
            if (path === pp) {
                return true;
            }
        }
        return false;
    }

    /*---------------/
    -DOM adjustments-
    /---------------*/
    loadDisplay();

    function loadDisplay() {
        editOriginalDom();
        const parentDiv = document.getElementsByClassName('awsui-row')[0];
        const mainDiv = makePluginDisplay();
        const ceTableDiv = makeTableDiv('ce');
        mainDiv.appendChild(ceTableDiv);
        const tsoTableDiv = makeTableDiv('tso');
        mainDiv.appendChild(tsoTableDiv);
        const vretsTableDiv = makeTableDiv('vrets');
        mainDiv.appendChild(vretsTableDiv); 
        parentDiv.appendChild(mainDiv);
        mainDiv.appendChild(makeSettingsButton());
        loadTables();
        //on load, tso and vrets tables are hidden
        document.getElementById('tso-table').style.display = 'none';
        document.getElementById('vrets-table').style.display = 'none';

        const overlay = makeOverlay();
        mainDiv.appendChild(overlay);
        styleSelectedLi();
        styleElements();                      
    }


    function editOriginalDom() {
        //use original feature to default hide this div on load
        let displayDiv = document.getElementById('awsui-expandable-section-6');
        if (displayDiv === null) {
            console.log('failed to load');
            alert('Plugin failed to load. Please reload to try again. If problem persists, please contact @mooshahe');
        }
        displayDiv.classList.remove('awsui-expandable-section-content-expanded');

        let divArrow = document.getElementById('awsui-expandable-section-6-trigger');
        divArrow.classList.remove('awsui-expandable-section-header-expanded');

        //hide legend display 
        document.getElementsByClassName('awsui-row')[1].style.display = 'none';
    }

    //main display for the plugin that will go at the top above all other divs
    function makePluginDisplay() {
        const div = document.createElement('div');
        div.setAttribute('id', 'main-div');

        return div;
    }

    function makeSettingsButton() {
        const button = document.createElement('button');
        button.setAttribute('id', 'settings-btn');
        button.textContent = '⚙ Settings ⚙';
        button.addEventListener('click', openOverlay);

        return button;
    }


    /*------------------/
    -Added DOM elements-
    /-----------------*/

    /*------------------/
    -Settings functionality to add/remove 
    paths to categories through local storage-
    /-----------------*/
    function makeOverlay() {
        const overlay = document.createElement('div');
        overlay.setAttribute('id', 'overlay');
        overlay.style.display = 'none';
        overlay.appendChild(makeSettingsDiv());

        return overlay;
    }

    function makeSettingsDiv() {
        const settingsDiv = document.createElement('div');
        settingsDiv.setAttribute('id', 'settings-div');

        const currentPathsDiv = document.createElement('div');
        currentPathsDiv.setAttribute('id', 'current-paths-div');

        const header = document.createElement('h3');
        header.textContent = 'Current Paths';
        currentPathsDiv.appendChild(header);

        const pathsDiv = document.createElement('div');
        pathsDiv.setAttribute('id', 'paths-div');
        currentPathsDiv.appendChild(pathsDiv);

        const ceDiv = document.createElement('div');
        ceDiv.setAttribute('id', 'current-ce-list-div');
        const ceHeader = document.createElement('h4');
        ceHeader.textContent = 'CE paths';
        ceDiv.appendChild(ceHeader);

        const ceList = document.createElement('ul');
        ceList.setAttribute('id', 'current-ce-paths');
        loadCurrentCePaths(ceList);
        ceDiv.appendChild(ceList);
        pathsDiv.appendChild(ceDiv);

        const tsoDiv = document.createElement('div');
        tsoDiv.setAttribute('id', 'current-tso-list-div');
        const tsoHeader = document.createElement('h4');
        tsoHeader.textContent = 'TSO paths';
        tsoDiv.appendChild(tsoHeader);

        const tsoList = document.createElement('ul');
        tsoList.setAttribute('id', 'current-tso-paths');
        loadCurrentTsoPaths(tsoList);
        tsoDiv.appendChild(tsoList);
        pathsDiv.appendChild(tsoDiv);

        const vretsDiv = document.createElement('div');
        vretsDiv.setAttribute('id', 'current-vrets-list-div');
        const vretsHeader = document.createElement('h4');
        vretsHeader.textContent = 'Vrets paths';
        vretsDiv.appendChild(vretsHeader);

        const vretsList = document.createElement('ul');
        vretsList.setAttribute('id', 'current-vrets-paths');
        loadCurrentVretsPaths(vretsList);
        vretsDiv.appendChild(vretsList);
        pathsDiv.appendChild(vretsDiv);

        const button = document.createElement('button');
        button.classList.add('settings-btn');
        button.setAttribute('id', 'remove-btn');
        button.textContent = 'Remove path';
        button.addEventListener('click', removeCurrentPath);
        currentPathsDiv.appendChild(button);

        settingsDiv.appendChild(currentPathsDiv);
        settingsDiv.appendChild(makeAllPathsDiv());
        settingsDiv.appendChild(makeCloseSettingsBtn());

        return settingsDiv;
    }

    function makeAllPathsDiv() {
        const allPathsDiv = document.createElement('div');
        allPathsDiv.setAttribute('id', 'all-paths-div');

        const header = document.createElement('h3');
        header.textContent = 'All Paths';
        allPathsDiv.appendChild(header);

        const mainSelectionDiv = document.createElement('div');
        mainSelectionDiv.setAttribute('id', 'main-selection-div');

        const listDiv = document.createElement('div');
        listDiv.setAttribute('id', 'list-div');

        const allPathsList = document.createElement('ul');
        allPathsList.setAttribute('id', 'all-paths-list');
        loadAllFreePaths(allPathsList); 
        listDiv.appendChild(allPathsList);
        mainSelectionDiv.appendChild(listDiv);

        const selectionDiv = document.createElement('div');
        selectionDiv.setAttribute('id', 'selection-div');

        const ceAddButton = document.createElement('button');
        ceAddButton.setAttribute('id', 'ce-btn');
        ceAddButton.classList.add('settings-btn');
        ceAddButton.textContent = 'Add to CE list';
        ceAddButton.addEventListener('click', addToCEList);
        selectionDiv.appendChild(ceAddButton);

        const tsoAddButton = document.createElement('button');
        tsoAddButton.setAttribute('id', 'tso-btn');
        tsoAddButton.classList.add('settings-btn');
        tsoAddButton.textContent = 'Add to TSO list';
        tsoAddButton.addEventListener('click', addToTSOList);
        selectionDiv.appendChild(tsoAddButton);

        const vretsAddButton = document.createElement('button');
        vretsAddButton.setAttribute('id', 'vrets-btn');
        vretsAddButton.classList.add('settings-btn');
        vretsAddButton.textContent = 'Add to VRETs list';
        vretsAddButton.addEventListener('click', addToVretsList);
        selectionDiv.appendChild(vretsAddButton);

        mainSelectionDiv.appendChild(selectionDiv);
        allPathsDiv.appendChild(mainSelectionDiv);

        return allPathsDiv;
    }

    function makeCloseSettingsBtn() {
        const button = document.createElement('button');
        button.setAttribute('id', 'close-btn');
        button.textContent = 'X';
        button.addEventListener('click', closeSettings);

        return button;
    }

    /*-----------------/
    -DOM element logic-
    /----------------*/

    let currentFreeSelection;
    let currentAssignedSelection;
    let currentAssignedList;
    
    function closeSettings() {
        const overlay = document.getElementById('overlay');
        overlay.style.display = 'none';
        loadTables();
    }

    function loadCurrentCePaths(list) {
        const currentPaths = getCePaths();
        for (let pp of currentPaths) {
            list.appendChild(makeLi(list, pp));
        }
    }

    function loadCurrentTsoPaths(list) {
        const currentPaths = getTsoPaths();
        for (let pp of currentPaths) {
            list.appendChild(makeLi(list, pp));
        }
    }

    function loadCurrentVretsPaths(list) {
        const currentPaths = getVretsPaths();
        for (let pp of currentPaths) {
            list.appendChild(makeLi(list, pp));
        }
    }

    function removeCurrentPath() {
        if (currentAssignedSelection === '') {
            return;
        }
        switch (currentAssignedList) {
            case 'current-ce-paths':
                removeCePath(currentAssignedSelection);
                break;
            case 'current-tso-paths':
                removeTsoPath(currentAssignedSelection);
                break;
            case 'current-vrets-paths':
                removeVretsPath(currentAssignedSelection);
                break;
        }
        updateFreePathsList();
        updateCurrentLists();
    }

    function loadAllFreePaths(list) {
        //iterate through all process paths on the main page and filter out those that are also in local storage
        const rows = Array.from(document.getElementsByClassName('awsui-table-row'));
        for (let row of rows) {
            let pp = row.querySelectorAll('td')[0].textContent;
            if (!isCurrentPath(pp)) {
                list.appendChild(makeLi(list, pp));
            } 
        }
    }

    function updateFreePathsList() {
        const div = document.getElementById('list-div');
        const list = document.getElementById('all-paths-list');
        list.remove();
       
        const newList = document.createElement('ul');
        newList.setAttribute('id', 'all-paths-list');
        const rows = Array.from(document.getElementsByClassName('awsui-table-row'));
        for (let row of rows) {
            let pp = row.querySelectorAll('td')[0].textContent;
            if (!isCurrentPath(pp)) {
                newList.appendChild(makeLi(newList, pp));
            } 
        }
        div.appendChild(newList);
        styleElements();
    }

    function updateCurrentLists() {
        const currentCeList = document.getElementById('current-ce-paths');
        const currentTsoList = document.getElementById('current-tso-paths');
        const currentVretsList = document.getElementById('current-vrets-paths');
        currentCeList.remove();
        currentTsoList.remove();
        currentVretsList.remove();

        const ceDiv = document.getElementById('current-ce-list-div');
        const newCeList = document.createElement('ul');
        newCeList.setAttribute('id', 'current-ce-paths');
        getCePaths().forEach(pp => newCeList.appendChild(makeLi(newCeList, pp)));
        ceDiv.appendChild(newCeList);

        const tsoDiv = document.getElementById('current-tso-list-div');
        const newTsoList = document.createElement('ul');
        newTsoList.setAttribute('id', 'current-tso-paths');
        getTsoPaths().forEach(pp => newTsoList.appendChild(makeLi(newTsoList, pp)));
        tsoDiv.appendChild(newTsoList);

        const vretsDiv = document.getElementById('current-vrets-list-div');
        const newVretsList = document.createElement('ul');
        newVretsList.setAttribute('id', 'current-vrets-paths');
        getVretsPaths().forEach(pp => newVretsList.appendChild(makeLi(newVretsList, pp)));
        vretsDiv.appendChild(newVretsList);

        styleSelectedLi();

        styleElements();
    }

    function makeLi(list, pp) {
        const li = document.createElement('li');
        if (list.id === 'all-paths-list') {
            li.classList.add('all-paths-li');
            li.textContent = pp;
        } else {
            li.classList.add('current-path');
            li.textContent = pp;
        }

        li.onmouseover = li.style.cursor = 'pointer';

        return li;
    }


    /*
    lists should first check if there is a selected value, otherwise do nothing
    if there is a value, update the appropriate local storage to include this
    take that path out of all paths list by checking against local storage
    update current paths for that path by checking against local storage
    */
    function addToCEList() {
        console.log(`current selection: ${currentFreeSelection}`);
        if (currentFreeSelection === undefined || currentFreeSelection === '') {
            return;
        }
        addCePath(currentFreeSelection);
        updateFreePathsList();
        updateCurrentLists();
        clearSelectedPath();
    }

    function addToTSOList() {
        console.log(`current selection: ${currentFreeSelection}`);
        if (currentFreeSelection === undefined || currentFreeSelection === '') {
            return;
        }
        addTsoPath(currentFreeSelection);
        updateFreePathsList();
        updateCurrentLists();
        clearSelectedPath();
    }

    function addToVretsList() {
        console.log(`current selection: ${currentFreeSelection}`);
        if (currentFreeSelection === undefined || currentFreeSelection === '') {
            return;
        }
        addVretsPath(currentFreeSelection);
        updateFreePathsList();
        updateCurrentLists();
        clearSelectedPath();
    }

    function makeTableDiv(category) {
        const div = document.createElement('div');
        div.setAttribute('id', `${category}-table-div`);

        return div;
    }

    function makeCeTable() {
        const ceTable = document.createElement('table');
        ceTable.setAttribute('id', 'ce-table');
        const titleRow = document.createElement('tr');
        const titleHeader = document.createElement('th');
        titleHeader.classList.add('table-header');
        titleHeader.textContent = 'CE Paths';
        titleHeader.colSpan = '10';
        titleRow.appendChild(titleHeader);
        ceTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        const td1 = makeTd('Process Path');
        categoriesRow.appendChild(td1);
        const td2 = makeTd('BL');
        categoriesRow.appendChild(td2);
        const td3 = makeTd('Status');
        categoriesRow.appendChild(td3);
        const td4 = makeTd('Active Pickers');
        categoriesRow.appendChild(td4);
        const td5 = makeTd('Set Pickers');
        categoriesRow.appendChild(td5);
        const td6 = makeTd('Delta');
        categoriesRow.appendChild(td6);
        const td7 = makeTd('Actual TUR');
        categoriesRow.appendChild(td7);
        const td8 = makeTd('Set TUR');
        categoriesRow.appendChild(td8);
        const td9 = makeTd('Actual Rate');
        categoriesRow.appendChild(td9);
        const td10 = makeTd('Set Rate');
        categoriesRow.appendChild(td10);
        ceTable.appendChild(categoriesRow);
        
        return ceTable;
    }

    function makeTsoTable() {
        const tsoTable = document.createElement('table');
        tsoTable.setAttribute('id', 'tso-table');
        const titleRow = document.createElement('tr');
        const titleHeader = document.createElement('th');
        titleHeader.classList.add('table-header');
        titleHeader.textContent = 'TSO Paths';
        titleHeader.colSpan = '8';
        titleRow.appendChild(titleHeader);
        tsoTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        const td1 = makeTd('Process Path');
        categoriesRow.appendChild(td1);
        const td2 = makeTd('BL');
        categoriesRow.appendChild(td2);
        const td3 = makeTd('Status');
        categoriesRow.appendChild(td3);
        const td4 = makeTd('Active Pickers');
        categoriesRow.appendChild(td4);
        const td5 = makeTd('Set Pickers');
        categoriesRow.appendChild(td5);
        const td6 = makeTd('Delta');
        categoriesRow.appendChild(td6);
        const td7 = makeTd('Actual TUR');
        categoriesRow.appendChild(td7);
        const td8 = makeTd('Set TUR');
        categoriesRow.appendChild(td8);
        tsoTable.appendChild(categoriesRow);
        
        // titleHeader.colSpan = '1';
        
        return tsoTable;
    }

    function makeVretsTable() {
        const vretsTable = document.createElement('table');
        vretsTable.setAttribute('id', 'vrets-table');
        const titleRow = document.createElement('tr');
        const titleHeader = document.createElement('th');
        titleHeader.classList.add('table-header');
        titleHeader.textContent = 'Vrets Paths';
        titleHeader.colSpan = '8';
        titleRow.appendChild(titleHeader);
        vretsTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        const td1 = makeTd('Process Path');
        categoriesRow.appendChild(td1);
        const td2 = makeTd('BL');
        categoriesRow.appendChild(td2);
        const td3 = makeTd('Status');
        categoriesRow.appendChild(td3);
        const td4 = makeTd('Active Pickers');
        categoriesRow.appendChild(td4);
        const td5 = makeTd('Set Pickers');
        categoriesRow.appendChild(td5);
        const td6 = makeTd('Delta');
        categoriesRow.appendChild(td6);
        const td7 = makeTd('Actual TUR');
        categoriesRow.appendChild(td7);
        const td8 = makeTd('Set TUR');
        categoriesRow.appendChild(td8);
        vretsTable.appendChild(categoriesRow);
        
        // titleHeader.colSpan = '1';
        
        return vretsTable;
    }

    function loadTables() {
        const ceTableDiv = document.getElementById('ce-table-div');
        ceTableDiv.textContent = '';
        ceTableDiv.appendChild(makeCeArrowToggle());
        ceTableDiv.appendChild(loadCeTable())
        
        const tsoTableDiv = document.getElementById('tso-table-div');
        tsoTableDiv.textContent = '';
        tsoTableDiv.appendChild(makeTsoArrowToggle());
        tsoTableDiv.appendChild(loadTsoTable());

        const vretsTableDiv = document.getElementById('vrets-table-div');
        vretsTableDiv.textContent = '';
        vretsTableDiv.appendChild(makeVretsArrowToggle());
        vretsTableDiv.appendChild(loadVretsTable());
    }

    function makeCeArrowToggle() {
        const button = document.createElement('button');
        button.classList.add('arrow-toggle');
        button.textContent = '▼';

        button.addEventListener('click', (e) => {
            toggleParentElement(e);
            if (e.target.textContent.includes('▼')) {
                e.target.textContent = '▶';
                const span = document.createElement('span');
                span.textContent = 'Toggle CE Table';
                button.appendChild(span);
                styleSpans();
                span.style.color = '#0073bb';
                span.style.fontWeight = 'bold';
                span.style.fontSize = '1.4rem';
            } else {
                e.target.textContent = '▼';
            }
        })

        return button;
    }

    function makeTsoArrowToggle() {
        const button = document.createElement('button');
        button.classList.add('arrow-toggle');
        button.textContent = '▶';
        const span = document.createElement('span');
        span.textContent = 'Toggle Vrets Table';
        button.appendChild(span);
        span.style.color = '#0073bb';
        span.style.fontWeight = 'bold';
        span.style.fontSize = '1.4rem';

        button.addEventListener('click', (e) => {
            toggleParentElement(e);
            if (e.target.textContent.includes('▼')) {
                e.target.textContent = '▶';
                const span = document.createElement('span');
                span.textContent = 'Toggle TSO Table';
                button.appendChild(span);
                styleSpans();
                span.style.color = '#0073bb';
                span.style.fontWeight = 'bold';
                span.style.fontSize = '1.4rem';
            } else {
                e.target.textContent = '▼';
            }
        })

        return button;
    }

    function makeVretsArrowToggle() {
        const button = document.createElement('button');
        button.classList.add('arrow-toggle');
        button.textContent = '▶';
        const span = document.createElement('span');
        span.textContent = 'Toggle Vrets Table';
        button.appendChild(span);
        span.style.color = '#0073bb';
        span.style.fontWeight = 'bold';
        span.style.fontSize = '1.4rem';

        button.addEventListener('click', (e) => {
            toggleParentElement(e);
            if (e.target.textContent.includes('▼')) {
                e.target.textContent = '▶';
                const span = document.createElement('span');
                span.textContent = 'Toggle Vrets Table';
                button.appendChild(span);
                styleSpans();
            } else {
                e.target.textContent = '▼';
            }
        })

        return button;
    }

    function toggleParentElement(e) {
        const table = e.target.parentElement.childNodes[1];
        if (table.style.display !== 'none') {
            table.style.display = 'none';
        } else {
            console.log('toggling back on');
            table.style.display = 'block';
        } 
    }

    function toggleArrow(e) {
        if (e.target.textContent === '▶') {
            e.target.textContent = '▼';
        } else {
            e.target.textContent = '▶';
        }
    }

    //updated tables only get called when you close settings
    function loadCeTable() {
        const table = makeCeTable();

        getCePaths().forEach(pp => {
            const row = document.createElement('tr');
            row.appendChild(makeTd(pp));
            table.appendChild(row);
        });

        return table;
    }

    function loadTsoTable() {
        const table = makeTsoTable();

        getTsoPaths().forEach(pp => {
            const row = document.createElement('tr');
            row.appendChild(makeTd(pp));
            table.appendChild(row);
        })

        return table;
    }

    function loadVretsTable() {
        const table = makeVretsTable();

        getVretsPaths().forEach(pp => {
            const row = document.createElement('tr');
            row.appendChild(makeTd(pp));
            table.appendChild(row);
        })

        return table;
    }

    function makeTd(str) {
        const td = document.createElement('td');
        td.textContent = str;
        return td;
    }

    //make getters for all the info needed

    /*--------/
    -Stylings-
    /-------*/
    function styleElements() {
        styleParentDiv();
        styleMainDiv();
        styleArrows();
        styleSettingsBtn();
        styleSettingsDiv();
        styleLists();
        removeLiStyle();
    }

    function styleParentDiv() {
        const parentDiv = document.getElementsByClassName('awsui-row')[0];
        parentDiv.style.display = 'flex';
    }

    function styleMainDiv() {
        const mainDiv = document.getElementById('main-div');
        mainDiv.style.width = '98.8%'; //not arbitrary. this will align the div with the existing divs
        mainDiv.style.boxSizing = 'border-box';
        mainDiv.style.boxShadow = '0 1px 1px 0 rgba(0,28,36,.3), 1px 1px 1px 0 rgba(0,28,36,.3), -1px 1px 1px 0 rgba(0,28,36,.3)';
        mainDiv.style.borderTop = '1px solid #EAEDED';
        mainDiv.style.display = 'flex';
        mainDiv.style.flexDirection = 'column';
        mainDiv.style.padding = '2rem';
        mainDiv.style.marginLeft = '1rem';
    }

    function styleArrows() {
        const arrows = Array.from(document.getElementsByClassName('arrow-toggle'));
        arrows.forEach(arrow => {
                arrow.style.fontSize = '1.5rem';
                arrow.style.color = '#645e5e';
                arrow.style.backgroundColor = 'transparent';
                arrow.style.border = 'none';
                arrow.style.display = 'flex';
                arrow.style.gap = '1rem';
            })
        arrows.forEach(arrow => arrow.onmouseover = arrow.style.cursor = 'pointer');
    }

    function styleSpans() {
        const spans = Array.from(document.getElementsByName('span'))
            .forEach(span => {
                span.style.color = '#0073bb';
                span.style.fontWeight = 'bold';
                span.style.fontSize = '1.4rem';
            });
    }

    function styleSettingsBtn() {
        const button = document.getElementById('settings-btn');
        button.style.fontSize = '2rem';
    }

    //call this when you click settings button to start displaying it
    function openOverlay() {
        const overlay = document.getElementById('overlay');
        overlay.style.zIndex = '1000';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
    }

    function styleSettingsDiv() {
        const settingsDiv = document.getElementById('settings-div');
        settingsDiv.style.border = '2px solid black';
        settingsDiv.style.backgroundColor = '#e4e4e7';
        settingsDiv.style.display = 'flex';
        settingsDiv.style.gap = '1rem';
        settingsDiv.style.minWidth = '50%';
        settingsDiv.style.borderRadius = '20px';

        const currentPathsDiv = document.getElementById('current-paths-div');
        currentPathsDiv.style.display = 'flex';
        currentPathsDiv.style.flexDirection = 'column';
        currentPathsDiv.style.alignItems = 'center';
        currentPathsDiv.style.padding = '1rem';

        const pathsDiv = document.getElementById('paths-div');
        pathsDiv.style.display = 'flex';

        const allPathsDiv = document.getElementById('all-paths-div');
        allPathsDiv.style.display = 'flex';
        allPathsDiv.style.flexDirection = 'column';
        allPathsDiv.style.alignItems = 'center';
        allPathsDiv.style.borderLeft = '2px solid black';
        allPathsDiv.style.padding = '1rem 1rem 1rem 2rem';

        const mainSelectionDiv = document.getElementById('main-selection-div');
        mainSelectionDiv.style.display = 'flex';
        mainSelectionDiv.style.marginTop = '3rem';
        mainSelectionDiv.style.gap = '3rem';

        const contentDiv = document.getElementById('selection-div');
        contentDiv.style.display = 'flex';
        contentDiv.style.flexDirection = 'column';
        contentDiv.style.gap = '5rem';
        contentDiv.style.paddingTop = '2rem';

        const closeBtn = document.getElementById('close-btn');
        closeBtn.style.position = 'relative';
        closeBtn.style.top = '10%';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '2rem';
        closeBtn.style.fontSize = '2rem';
        closeBtn.style.width = '3.5rem';
        closeBtn.style.height = '3.5rem';
        closeBtn.style.color = 'white';
        closeBtn.style.backgroundColor = '#dc2626';

        closeBtn.onmouseover = closeBtn.style.cursor = 'pointer';

        const removeBtn = document.getElementById('remove-btn');
        removeBtn.style.backgroundColor = '#EF4444';
        removeBtn.style.border = '2px solid darkred';
        removeBtn.style.marginTop = '2rem';
        removeBtn.style.marginLeft = '1.5rem';

        const ceBtn = document.getElementById('ce-btn');
        ceBtn.style.backgroundColor = '#3b82f6';
        ceBtn.style.border = '2px solid blue';

        const tsoBtn = document.getElementById('tso-btn');
        tsoBtn.style.backgroundColor = '#8B5CF6';
        tsoBtn.style.border = '2px solid #5B21B6';

        const vretsBtn = document.getElementById('vrets-btn');
        vretsBtn.style.backgroundColor = '#10B981';
        vretsBtn.style.border = '2px solid darkgreen';

        //stylings for both main headers
        const headers = Array.from(document.querySelectorAll('h3'))
            .forEach(header => header.style.marginLeft = '2rem');

        //common stylings for all three buttons
        const btns = Array.from(document.getElementsByClassName('settings-btn'));
        for (let btn of btns) {
            btn.style.width = '16rem';
            btn.style.fontSize = '1.7rem';
            btn.style.fontWeight = 'bold';
            btn.style.padding = '0.5rem 0 0.5rem 0';
            btn.style.color = 'white';
            btn.onmouseover = btn.style.cursor = 'pointer';
        }
    }

    function styleLists() {
        const lists = Array.from(document.querySelectorAll('ul'));
        for (let list of lists) {
            list.style.height = '25rem';
            list.style.overflow = 'scroll';
            list.style.overflowX = 'hidden';
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.backgroundColor = 'white';
            list.style.padding = '1rem';
        }
    }

    function removeLiStyle() {
        const lis = Array.from(document.querySelectorAll('li')) 
            .forEach(li => li.style.listStyle = 'none');
    }

    function styleSelectedLi() {
        const lis = Array.from(document.querySelectorAll('li'));
        lis.forEach(li => li.addEventListener('click', (e) => {
            console.log('click');
            for (let li of lis) {
                if (e.target === li) {
                    //if the li has not been selected, highlight it and set current selection to this li
                    if (!e.target.classList.contains('selected')) {
                        e.target.style.backgroundColor = 'darkblue';
                        e.target.style.color = 'white';
                        e.target.classList.add('selected');
                        if (li.classList.contains('current-path')) {
                            currentAssignedSelection = e.target.textContent;
                            currentAssignedList = e.target.parentElement.id;
                            console.log(currentAssignedList);
                            currentFreeSelection = '';
                        } else {
                            currentFreeSelection = e.target.textContent;
                            currentAssignedSelection = '';
                            currentAssignedList = '';
                        }
                    } else {
                        //if the li has already been selected, deselect it and remove li from current selection
                        e.target.style.backgroundColor = 'white';
                        e.target.style.color = 'black';
                        e.target.classList.remove('selected');
                        currentAssignedSelection = '';
                        currentFreeSelection = '';
                        currentAssignedList = '';
                    }
                } else {
                    //update all other li's to not be highlighted
                    li.style.backgroundColor = 'white';
                    li.style.color = 'black';
                    li.classList.remove('selected');
                }
            }
        }))
    }

    function clearSelectedPath() {
        const lis = Array.from(document.querySelectorAll('li'));
        lis.forEach(li => li.classList.remove('selected'));
        currentFreeSelection = '';
        currentAssignedSelection = '';
    }
};

/*to add
if takes too long to load, prompt user to reload page until it works
user settings must select all

add displaying last time TURs updated and by who

add progressive load count

on load display ceTable, but hide the others 

*/