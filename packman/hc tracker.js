// ==UserScript==
// @name         HC Tracker
// @updateURL    https://github.com/samoore036/CF-TamperMonkey-Scripts/blob/main/dwell-callouts/cpt-dwells.js
// @downloadURL  https://github.com/samoore036/CF-TamperMonkey-Scripts/blob/main/dwell-callouts/cpt-dwells.js
// @namespace    https://github.com/samoore036/CF-TamperMonkey-Scripts
// @version      1.1.0
// @description  Display all pick settings, including hcs, and pack hcs
// @author       mooshahe
// @match        https://insights.prod-na.pack.aft.a2z.com/packman/recent?fc=*
// @grant        GM.xmlHttpRequest
// @connect      process-path.na.picking.aft.a2z.com
// @connect      insights.prod-na.pack.aft.a2z.com
// @connect      picking-console.na.picking.aft.a2z.com
// ==/UserScript==

/*
ready state changes do not work at all, neither does window/document.loaded.
fc console is dynamically generated so must wait until it is completely loaded
*/

let fc = document.URL.split('=')[1];

//three requests to be made: get active process path data, get set process path data and get active batches
const activeData = new Promise(function(resolve) {
    GM.xmlHttpRequest({
        method: 'GET',
        url: `https://picking-console.na.picking.aft.a2z.com/api/fcs/${fc}/process-paths/information`,
        onreadystatechange: function(response) {
            if (response.readyState == 4 && response.status == 200) {
                resolve(this.response);
            } 
        }
    })
})

const setData = new Promise(function(resolve) {
        GM.xmlHttpRequest({
            method: "GET",
            url: `https://process-path.na.picking.aft.a2z.com/api/processpath/${fc}/processPathWithUserSettingsList`,
            onreadystatechange: function(response) {
                if (response.readyState == 4 && response.status == 200) {
                    resolve(this.response);
                }  
            }
        })
});

const batchData = new Promise(function(resolve) {
    GM.xmlHttpRequest({
        method: 'GET',
        url: `https://picking-console.na.picking.aft.a2z.com/api/fcs/${fc}/batch-info/Active`,
        onreadystatechange: function(response) {
            if (response.readyState == 4 && response.status == 200) {
                resolve(this.response);
            } 
        }
    })
})

// packman grabs it's own apis and loads dom, so must wait for these to load before executing script
//after data is retrieved for set process paths, get active batch data, then wait until DOM is loaded then execute script
Promise.all([activeData, setData, batchData]).then((data) => {
    setTimeout(() => {
        loadScript(data);
    }, 4000);
})

function loadScript(data) {
    const activeData = JSON.parse(data[0]).processPathInformationMap;
    const setData = JSON.parse(data[1]).processPaths; //gives an array of all process paths with set settings
    let batchData = {};
    if (JSON.parse(data[2])) {
        batchData = JSON.parse(data[2]).pickBatchInformationList;
    } else {
        batchData = null;
    }
    console.log(activeData);
    console.log(setData);
    console.log(batchData);

    /*----------------/
    -global variables-
    /----------------*/
    // paths that are not categorized yet
    const freeSelectedPaths = [];
    // category paths
    const ceSelectedPaths = [];
    const tsoSelectedPaths = [];
    const vretsSelectedPaths = [];

    // totals used for the summary table
    let activePickersTotal = 0;
    let setPickersTotal = 0;
    let activeMultisTotal = 0;
    let setMultisTotal = 0;
    let activeSinglesTotal = 0;
    let setSinglesTotal = 0;

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

    const packHeadcounts = {
        singles: 0,
        multis: 0,
        bod: 0,
        slap: 0,
        handTape: 0
    }

    /*-----------------------/
    -data CRUD functionality-
    /-----------------------*/

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

    function removeCePath(pp) {
        const currentCePaths = getCePaths();
        currentCePaths.splice(currentCePaths.indexOf(pp), 1);
        
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

    function removeTsoPath(pp) {
        const currentTsoPaths = getTsoPaths();
        currentTsoPaths.splice(currentTsoPaths.indexOf(pp), 1);
        
        localStorage.setItem(`${fc}-tso`, JSON.stringify(currentTsoPaths));
    }

    function getVretsPaths() {
        let vretsArr = JSON.parse(localStorage.getItem(`${fc}-vrets`))
        if (vretsArr.includes(',')) {
            const arr = vretsArr[0].split(',');
            const trimmedArr = arr.map(path => path.trim());
            return trimmedArr.sort();
        }

        return vretsArr.sort();
    }

    function removeVretsPath(pp) {
        const currentVretsPaths = getVretsPaths();
        currentVretsPaths.splice(currentVretsPaths.indexOf(pp), 1);
        
        localStorage.setItem(`${fc}-vrets`, JSON.stringify(currentVretsPaths));
    }

    parseData(getPackData());

    makeDivs();
    
    loadPickTableData();
    loadPackTableData();

    // there is no get api so must iterate over the DOM and create an object with each packer's information to then parse

    // main methods
    function getPackData() {
        const packData = [];

        const rows = Array.from(document.querySelector('tbody').querySelectorAll('tr'));
        for (let i = 0; i < rows.length; i++) {
            // filter out if end time is greater than 15 minutes
            const endTime = rows[i].querySelectorAll('td')[3].textContent;
            if (!isWithin15Mins(endTime)) {
                continue;
            } else {
                packData.push({
                    workStation: rows[i].querySelectorAll('td')[5].textContent.trim(),
                    packMode: rows[i].querySelectorAll('td')[6].textContent.trim(),
                    processPath: rows[i].querySelectorAll('td')[7].textContent.trim()
                })

            }
        }

        return packData;
    }

    function parseData(packData) {
        for (let i = 0; i < packData.length; i++) {
            // if ((packData[i].processPath.includes('Single') || packData[i].processPath.includes('HOV')) && (packData[i].workStation.includes('wsPack') || packData[i].workStation.includes('wsGW'))) {
            //     singles++;
            //     continue;
            // }
            // if (packData[i].packMode === 'rebin') {
            //     multis++;
            //     continue;
            // }
            // if (packData[i].workStation.match('ws[0-9]+') || (packData[i].workStation.includes('BOD') && packData[i].processPath.includes('NonCon'))) {
            //     slap++;
            //     continue;
            // }
            // if (packData[i].processPath.includes('HandTape') && packData[i].workStation.includes('wsBOD')) {
            //     handTape++;
            //     continue;
            // }
            // if (packData[i].workStation.includes('wsBOD')) {
            //     bod++;
            // }
            const { processPath, packMode, workStation } = packData[i];
            // skip psolve
            if (workStation.includes('POPS' || workStation.includes('pops'))) {
                continue;
            }
            if (processPath.includes('MCF')) {
                if (packMode.includes('singles_slam')) {
                    packHeadcounts.slap++;
                    continue;
                }
                if (workStation.includes('BOD')) {
                    packHeadcounts.bod++;
                    continue;
                }
                packHeadcounts.singles++;
            }
            if (processPath.includes('Single') && !processPath.includes('BOD') && !processPath.includes('NonCon') && !processPath.includes('SIOC') && !processPath.includes('HandTape')) {
                packHeadcounts.singles++;
            }
            if (processPath.includes('Multi')) {
                packHeadcounts.multis++;
            }
            if (processPath.includes('NonCon')) {
                packHeadcounts.slap++;
            }
            if (processPath.includes('HandTape')) {
                packHeadcounts.handTape++;
            }
            if (processPath.includes('BOD')) {
                packHeadcounts.bod++;
            }
            if (processPath.includes('HOV')) {
                if (packMode.includes('singles')) {
                    packHeadcounts.singles++;
                } else if (packMode.includes('singles_slam') && workStation.includes('BOD')) {
                    packHeadcounts.bod++;
                } else {
                    packHeadcounts.slap++;
                }
            }
        }
    }

    function makeDivs() {
        const parentDiv = document.getElementsByClassName('mat-tab-body-content')[0];
        const overlay = makeOverlay();
        overlay.appendChild(makeSettingsDiv());
        parentDiv.appendChild(overlay);

        const masterDiv = makeMasterDiv();
        masterDiv.setAttribute('id', 'master-div');
        masterDiv.style.cssText += `
            padding: 1rem;
            display: flex;
            gap: 2vw;
            font-size: 1.4rem;
            line-height: 2rem;
            font-family: sans-serif;
        `
        parentDiv.appendChild(masterDiv);

        const pickDiv = makePickDiv();
        pickDiv.setAttribute('id', 'pick-div');
        masterDiv.appendChild(pickDiv);

        const packDiv = makePackDiv();
        const packTable = makePackTable();
        packDiv.appendChild(packTable);
        masterDiv.appendChild(packTable);

        parentDiv.prepend(masterDiv);
    }

    // helper methods
    function isWithin15Mins(endTime) {
        // convert to date object for comparison
        const pieces = endTime.trim().split(' ');
        const year = pieces[2];
        const month = pieces[0];
        const day = pieces[1];
        const am = pieces[4] === 'AM' ? true : false;
        const timeString = pieces[3].split(':');
        const hour = am ? timeString[0] : parseInt(timeString[0]) + 12;
        const minute = timeString[1];
        const second = timeString[2];
        
        const endTimeObj = new Date(`${month} ${day}, ${year} ${hour}:${minute}:${second}`);
        
        let timeNowWithTimePref = new Date();
        let newMinutes = timeNowWithTimePref.getMinutes() - 15;
        timeNowWithTimePref.setMinutes(newMinutes);

        return timeNowWithTimePref > endTimeObj ? false : true;
    }

    /*------------------/
    -Added DOM elements-
    /-----------------*/

    function makeOverlay() {
        const overlay = document.createElement('div');
        overlay.setAttribute('id', 'overlay');
        overlay.style.display = 'none';

        return overlay;
    }

    function makeSettingsDiv() {
        const settingsDiv = document.createElement('div');
        settingsDiv.setAttribute('id', 'settings-div');
        settingsDiv.style.cssText += `
            border: 2px solid black;
            background-color: #e4e4e7;
            display: flex;
            border-radius: 20px;
            font-family: sans-serif;
            font-size: 15px;
        `

        const currentPathsDiv = document.createElement('div');
        currentPathsDiv.setAttribute('id', 'current-paths-div');
        currentPathsDiv.style.cssText += `
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
        `

        const header = document.createElement('h3');
        header.textContent = 'Current Paths';
        header.style.cssText += 'margin: 0;'
        currentPathsDiv.appendChild(header);

        const pathsDiv = document.createElement('div');
        pathsDiv.setAttribute('id', 'paths-div');
        pathsDiv.style.cssText += `display: flex`;
        currentPathsDiv.appendChild(pathsDiv);

        const ceDiv = document.createElement('div');
        ceDiv.setAttribute('id', 'current-ce-list-div');
        const ceHeader = document.createElement('h4');
        ceHeader.textContent = 'CE paths';
        ceDiv.appendChild(ceHeader);

        const ceList = document.createElement('ul');
        ceList.setAttribute('id', 'current-ce-paths');
        ceList.style.cssText += `
            height: 11rem;
            min-width: 150px;
            overflow: hidden scroll;
            display: flex;
            flex-direction: column;
            background-color: white;
            padding: 1rem;
        `
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
        tsoList.style.cssText += `
            height: 11rem;
            min-width: 150px;
            overflow: hidden scroll;
            display: flex;
            flex-direction: column;
            background-color: white;
            padding: 1rem;
        `
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
        vretsList.style.cssText += `
            height: 11rem;
            min-width: 150px;
            overflow: hidden scroll;
            display: flex;
            flex-direction: column;
            background-color: white;
            padding: 1rem;
        `
        loadCurrentVretsPaths(vretsList);
        vretsDiv.appendChild(vretsList);
        pathsDiv.appendChild(vretsDiv);

        const buttonDiv = document.createElement('div');
        buttonDiv.setAttribute('id', 'button-div');
        buttonDiv.style.cssText += `
            display: flex;
            gap: 4vw;
        `

        const removeButton = document.createElement('button');
        removeButton.setAttribute('id', 'remove-btn');
        removeButton.style.cssText += `
            background-color: rgb(239, 68, 68);
            border: 2px solid darkred;
            margin-top: 1rem;
            margin-left: 1.5rem;
            font-weight: bold;
            font-size: 1.1rem;
            padding-left: 1rem;
            padding-right: 1rem;
            padding-top: 0.4rem;
            padding-bottom: 0.4rem;
            color: white;
            cursor: pointer;
        `
        removeButton.textContent = 'Remove paths';
        removeButton.addEventListener('click', removeCurrentPaths);
        buttonDiv.appendChild(removeButton);

        //has the same functionality as the close settings button. added as users were searching for a button to press after putting in paths
        const saveButton = document.createElement('button');
        saveButton.setAttribute('id', 'save-btn');
        saveButton.style.cssText += `
            background-color: rgb(52, 211, 153);
            border: 2px solid darkgreen;
            margin-top: 1rem;
            margin-left: 1.5rem;
            font-weight: bold;
            font-size: 1.1rem;
            padding-left: 1rem;
            padding-right: 1rem;
            color: white;
            cursor: pointer;
        `
        saveButton.textContent = 'Save paths';
        saveButton.addEventListener('click', closeSettings);
        buttonDiv.appendChild(saveButton);
        currentPathsDiv.appendChild(buttonDiv);

        settingsDiv.appendChild(currentPathsDiv);
        settingsDiv.appendChild(makeAllPathsDiv());
        settingsDiv.appendChild(makeCloseSettingsBtn());

        return settingsDiv;
    }

    function makeAllPathsDiv() {
        const allPathsDiv = document.createElement('div');
        allPathsDiv.setAttribute('id', 'all-paths-div');
        allPathsDiv.style.cssText += `
            display: flex;
            flex-direction: column;
            align-items: center;
            border-left: 2px solid black;
            padding: 20px;
        `

        const header = document.createElement('h3');
        header.style.cssText += 'margin: 0;'
        header.textContent = 'All Paths';
        allPathsDiv.appendChild(header);

        const mainSelectionDiv = document.createElement('div');
        mainSelectionDiv.setAttribute('id', 'main-selection-div');
        mainSelectionDiv.style.cssText += `
            display: flex;
            margin-top: 3rem;
        `

        const listDiv = document.createElement('div');
        listDiv.setAttribute('id', 'list-div');

        const allPathsList = document.createElement('ul');
        allPathsList.style.cssText += `
            height: 11rem;
            overflow: hidden scroll;
            display: flex;
            flex-direction: column;
            background-color: white;
            padding: 1rem;
        `
        allPathsList.setAttribute('id', 'all-paths-list');
        loadAllFreePaths(allPathsList);
        listDiv.appendChild(allPathsList);
        mainSelectionDiv.appendChild(listDiv);

        const selectionDiv = document.createElement('div');
        selectionDiv.setAttribute('id', 'selection-div');
        selectionDiv.style.cssText += `
            display: flex;
            flex-direction: column;
        `

        const ceAddButton = document.createElement('button');
        ceAddButton.setAttribute('id', 'ce-btn');
        ceAddButton.style.cssText += `
            background-color: rgb(59, 130, 246);
            border: 2px solid blue;
            color: white;
            margin-top: 2rem;
            margin-left: 1.5rem;
            font-weight: bold;
            font-size: 14px;
            width: 10rem;
            padding-left: 1rem;
            padding-right: 1rem;
            padding-top: 0.4rem;
            padding-bottom: 0.4rem;
            cursor: pointer;
        `
        ceAddButton.textContent = 'Add to CE list';
        ceAddButton.addEventListener('click', addToCEList);
        selectionDiv.appendChild(ceAddButton);

        const tsoAddButton = document.createElement('button');
        tsoAddButton.setAttribute('id', 'tso-btn');
        tsoAddButton.style.cssText += `
            background-color: rgb(139, 92, 246);
            border: 2px solid rgb(91, 33, 182);
            color: white;
            margin-top: 2rem;
            margin-left: 1.5rem;
            font-weight: bold;
            font-size: 14px;
            width: 10rem;
            padding-left: 1rem;
            padding-right: 1rem;
            padding-top: 0.4rem;
            padding-bottom: 0.4rem;
            cursor: pointer;
        `
        
        tsoAddButton.textContent = 'Add to TSO list';
        tsoAddButton.addEventListener('click', addToTSOList);
        selectionDiv.appendChild(tsoAddButton);

        const vretsAddButton = document.createElement('button');
        vretsAddButton.setAttribute('id', 'vrets-btn');
        vretsAddButton.style.cssText += `
            background-color: rgb(16, 185, 129);
            border: 2px solid darkgreen;
            color: white;
            margin-top: 2rem;
            margin-left: 1.5rem;
            font-weight: bold;
            font-size: 14px;
            width: 10rem;
            padding-left: 1rem;
            padding-right: 1rem;
            padding-top: 0.4rem;
            padding-bottom: 0.4rem;
            cursor: pointer;
        `
        
        vretsAddButton.textContent = 'Add to VRETs list';
        vretsAddButton.addEventListener('click', addToVretsList);
        selectionDiv.appendChild(vretsAddButton);

        mainSelectionDiv.appendChild(selectionDiv);
        allPathsDiv.appendChild(mainSelectionDiv);

        return allPathsDiv;
    }

    function makeOpenSettingsButton() {
        const button = document.createElement('button');
        button.setAttribute('id', 'settings-btn');
        button.style.cssText += `
            height: 3rem;
            width: 7rem;
            border: 2px solid darkblue;
            background-color: #FDE68A;
            font-size: 1.1rem;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
        `
        button.textContent = 'Process Path Settings';
        button.style.cursor = 'pointer';
        button.addEventListener('click', openSettings);
        
        return button;
    }

    function makeCloseSettingsBtn() {
        const button = document.createElement('button');
        button.setAttribute('id', 'close-btn');
        button.style.cssText += `
            position: relative;
            left: 1rem;
            bottom: 1rem;
            border: medium none;
            border-radius: 2rem;
            font-size: 1.7rem;
            width: 2.5rem;
            height: 2.5rem;
            color: white;
            background-color: rgb(220, 38, 38);
            cursor: pointer;
        `
        button.textContent = '✖';
        button.addEventListener('click', closeSettings);

        return button;
    }

    function makeMasterDiv() {
        const masterDiv = document.createElement('div');

        return masterDiv;
    }

    function makePickDiv() {
        const pickDiv = document.createElement('div');
        const settingsDiv = document.createElement('div');
        settingsDiv.appendChild(makeOpenSettingsButton());
        pickDiv.appendChild(settingsDiv);

        const ceTableDiv = document.createElement('div');
        ceTableDiv.appendChild(makeCeArrowToggle());
        ceTableDiv.appendChild(makeTotalsDiv());
        ceTableDiv.appendChild(makeCePickTable());
        pickDiv.appendChild(ceTableDiv);

        const tsoTableDiv = document.createElement('div');
        tsoTableDiv.appendChild(makeTsoArrowToggle());
        tsoTableDiv.appendChild(makeTsoPickTable());
        pickDiv.appendChild(tsoTableDiv);

        const vretsTableDiv = document.createElement('div');
        vretsTableDiv.appendChild(makeVretsArrowToggle());
        vretsTableDiv.appendChild(makeVretsPickTable());
        pickDiv.appendChild(vretsTableDiv);

        return pickDiv;
    }

    function makePackDiv() {
        const packDiv = document.createElement('div');

        return packDiv;
    }

    function makeCePickTable() {
        const ceTable = document.createElement('table');
        ceTable.setAttribute('id', 'ce-table');
        const titleRow = document.createElement('tr');
        titleRow.style.fontSize = '2rem';
        titleRow.style.color = 'white';
        titleRow.style.backgroundColor = '#3b82f6';
        titleRow.style.border = '1px solid black';
        titleRow.style.borderBottom = 'none';
        const titleHeader = document.createElement('th');
        titleHeader.classList.add('table-header');
        titleHeader.textContent = 'CE Paths';
        titleHeader.colSpan = '11';
        titleRow.appendChild(titleHeader);
        ceTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.fontSize = '1.5rem';
        categoriesRow.style.color = 'white';
        categoriesRow.style.backgroundColor = '#3b82f6';
        categoriesRow.style.borderLeft = '1px solid black';
        categoriesRow.style.borderRight = '1px solid black';

        const td1 = makeHeaderTd('Process Path');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('BL/Active');
        td2.title = 'Batch Limit/Current active batches';
        td2.style.cursor = 'help';
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Active Pickers');
        categoriesRow.appendChild(td3);
        const td4 = makeHeaderTd('Planned Pickers');
        categoriesRow.appendChild(td4);
        const td5 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td5);
        const td6 = makeHeaderTd('Deviation');
        categoriesRow.appendChild(td6);
        const td7 = makeHeaderTd('Actual TUR');
        categoriesRow.appendChild(td7);
        const td8 = makeHeaderTd('Set TUR');
        categoriesRow.appendChild(td8);
        const td9 = makeHeaderTd('Actual Rate');
        categoriesRow.appendChild(td9);
        const td10 = makeHeaderTd('Set Rate');
        categoriesRow.appendChild(td10);
        const td11 = makeHeaderTd('Status');
        categoriesRow.appendChild(td11);
        ceTable.appendChild(categoriesRow);

        return ceTable;
    }

    function makeTotalsDiv() {
        const div = document.createElement('div');
        div.setAttribute('id', 'pick-totals-div');

        const activeDiv = document.createElement('div');
        activeDiv.title = 'Active picker total does not take HOV paths into account.';
        activeDiv.style.cursor = 'help';
        activeDiv.setAttribute('id', 'active-div');
        const activeTitleDiv = document.createElement('div');
        activeTitleDiv.textContent = 'Active Pickers';
        activeTitleDiv.style.color = 'grey';
        activeDiv.appendChild(activeTitleDiv);
        const activePickers = document.createElement('div');
        activePickers.setAttribute('id', 'active-pickers-div');

        activeDiv.appendChild(activePickers);

        div.appendChild(activeDiv);

        const setDiv = document.createElement('div');
        setDiv.setAttribute('id', 'set-div');
        setDiv.title = 'Planned picker total does not take HOV paths into account.';
        setDiv.style.cursor = 'help';
        const setTitleDiv = document.createElement('div');
        setTitleDiv.textContent = 'Planned Pickers';
        setTitleDiv.style.color = 'grey';
        setDiv.appendChild(setTitleDiv);
        const setPickers = document.createElement('div');
        setPickers.setAttribute('id', 'set-pickers-div');
        setDiv.appendChild(setPickers);
        div.appendChild(setDiv);

        return div;
    }

    function makeTsoPickTable() {
        const tsoTable = document.createElement('table');
        tsoTable.setAttribute('id', 'tso-table');
        const titleRow = document.createElement('tr');
        titleRow.style.fontSize = '2rem';
        titleRow.style.color = 'white';
        titleRow.style.backgroundColor = '#8B5CF6';
        titleRow.style.border = '1px solid black';
        titleRow.style.borderBottom = 'none';
        const titleHeader = document.createElement('th');
        titleHeader.classList.add('table-header');
        titleHeader.textContent = 'TSO Paths';
        titleHeader.colSpan = '9';
        titleRow.appendChild(titleHeader);
        tsoTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.fontSize = '1.5rem';
        categoriesRow.style.color = 'white';
        categoriesRow.style.backgroundColor = '#8B5CF6';
        categoriesRow.style.borderLeft = '1px solid black';
        categoriesRow.style.borderRight = '1px solid black';

        const td1 = makeHeaderTd('Process Path');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('BL');
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Active Pickers');
        categoriesRow.appendChild(td3);
        const td4 = makeHeaderTd('Planned Pickers');
        categoriesRow.appendChild(td4);
        const td5 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td5);
        const td6 = makeHeaderTd('Deviation');
        categoriesRow.appendChild(td6);
        const td7 = makeHeaderTd('Actual TUR');
        categoriesRow.appendChild(td7);
        const td8 = makeHeaderTd('Set TUR');
        categoriesRow.appendChild(td8);
        const td9 = makeHeaderTd('Status');
        categoriesRow.appendChild(td9);
        tsoTable.appendChild(categoriesRow);

        return tsoTable;
    }

    function makeVretsPickTable() {
        const vretsTable = document.createElement('table');
        vretsTable.setAttribute('id', 'vrets-table');
        // by default vrets table is hidden on load
        vretsTable.style.display = 'none';
        const titleRow = document.createElement('tr');
        titleRow.style.fontSize = '2rem';
        titleRow.style.color = 'white';
        titleRow.style.backgroundColor = '#10B981';
        titleRow.style.border = '1px solid black';
        titleRow.style.borderBottom = 'none';
        const titleHeader = document.createElement('th');
        titleHeader.classList.add('table-header');
        titleHeader.textContent = 'Vrets Paths';
        titleHeader.colSpan = '9';
        titleRow.appendChild(titleHeader);
        vretsTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.fontSize = '1.5rem';
        categoriesRow.style.color = 'white';
        categoriesRow.style.backgroundColor = '#10B981';
        categoriesRow.style.borderLeft = '1px solid black';
        categoriesRow.style.borderRight = '1px solid black';

        const td1 = makeHeaderTd('Process Path');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('BL');
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Active Pickers');
        categoriesRow.appendChild(td3);
        const td4 = makeHeaderTd('Planned Pickers');
        categoriesRow.appendChild(td4);
        const td5 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td5);
        const td6 = makeHeaderTd('Deviation');
        categoriesRow.appendChild(td6);
        const td7 = makeHeaderTd('Actual TUR');
        categoriesRow.appendChild(td7);
        const td8 = makeHeaderTd('Set TUR');
        categoriesRow.appendChild(td8);
        const td9 = makeHeaderTd('Status');
        categoriesRow.appendChild(td9);
        vretsTable.appendChild(categoriesRow);

        return vretsTable;
    }

    function makeCeArrowToggle() {
        const div = document.createElement('div');
        div.style.display = 'flex';

        const button = document.createElement('button');
        button.style.cssText += `
            font-size: 1.1rem;
            color: #645e5e;
            background-color: transparent;
            border: none;
            display: flex;
            gap: 1rem;
            cursor: pointer;
        `
        button.textContent = '▼';
        div.appendChild(button);

        button.addEventListener('click', (e) => {
            const totalsDiv = document.getElementById('pick-totals-div');
            const ceTable = document.getElementById('ce-table');
            if (e.target.textContent.includes('▼')) {
                e.target.textContent = '▶';
                const span = document.createElement('span');
                span.setAttribute('id', 'ce-span');
                span.textContent = 'Toggle CE Table';
                span.style.cssText += `
                    color: #0073bb;
                    font-weight: bold;
                    font-size: 1.1rem;
                `
                div.appendChild(span);
                totalsDiv.style.display = 'none';
                ceTable.style.display = 'none';
            } else {
                e.target.textContent = '▼';
                let span = document.getElementById('ce-span');
                span.remove();
                totalsDiv.style.display = 'flex';
                ceTable.style.display = 'flex';
            }
        })

        return div;
    }

    function makeTsoArrowToggle() {
        const div = document.createElement('div');
        div.style.display = 'flex';

        const button = document.createElement('button');
        button.style.cssText += `
            font-size: 1.1rem;
            color: #645e5e;
            background-color: transparent;
            border: none;
            display: flex;
            gap: 1rem;
            cursor: pointer;
        `
        button.textContent = '▼';
        div.appendChild(button);

        button.addEventListener('click', (e) => {
            const tsoTable = document.getElementById('tso-table');
            if (e.target.textContent.includes('▼')) {
                e.target.textContent = '▶';
                const span = document.createElement('span');
                span.setAttribute('id', 'tso-span');
                span.textContent = 'Toggle TSO Table';
                span.style.cssText += `
                    color: #0073bb;
                    font-weight: bold;
                    font-size: 1.1rem;
                `
                div.appendChild(span);
                tsoTable.style.display = 'none';
            } else {
                e.target.textContent = '▼';
                let span = document.getElementById('tso-span');
                span.remove();
                tsoTable.style.display = 'flex';
            }
        })

        return div;
    }

    function makeVretsArrowToggle() {
        const div = document.createElement('div');
        div.style.display = 'flex';

        const button = document.createElement('button');
        button.style.cssText += `
            font-size: 1.1rem;
            color: #645e5e;
            background-color: transparent;
            border: none;
            display: flex;
            gap: 1rem;
            cursor: pointer;
        `
        button.textContent = '▶';
        div.appendChild(button);

        const span = document.createElement('span');
        span.setAttribute('id', 'vrets-span');
        span.textContent = 'Toggle Vrets Table';
        span.style.cssText += `
                    color: #0073bb;
                    font-weight: bold;
                    font-size: 1.1rem;
                `
        div.appendChild(span);

        button.addEventListener('click', (e) => {
            const vretsTable = document.getElementById('vrets-table');
            if (e.target.textContent.includes('▼')) {
                e.target.textContent = '▶';
                const span = document.createElement('span');
                span.setAttribute('id', 'vrets-span');
                span.textContent = 'Toggle Vrets Table';
                span.style.cssText += `
                    color: #0073bb;
                    font-weight: bold;
                    font-size: 1.1rem;
                `
                div.appendChild(span);
                vretsTable.style.display = 'none';
            } else {
                e.target.textContent = '▼';
                let span = document.getElementById('vrets-span');
                span.remove();
                vretsTable.style.display = 'flex';
            }
        })

        return div;
    }

    function makePackTable() {
        const packTable = document.createElement('table');
        packTable.setAttribute('id', 'pack-table');
        const titleRow = document.createElement('tr');
        titleRow.style.fontSize = '2rem';
        titleRow.style.color = 'white';
        titleRow.style.backgroundColor = '#3b82f6';
        titleRow.style.border = '1px solid black';
        titleRow.style.borderBottom = 'none';
        const titleHeader = document.createElement('th');
        titleHeader.classList.add('table-header');
        titleHeader.textContent = `Pack hcs in the last 15 minutes`;
        titleHeader.colSpan = '11';
        titleRow.appendChild(titleHeader);
        packTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.fontSize = '1.5rem';
        categoriesRow.style.color = 'white';
        categoriesRow.style.backgroundColor = '#3b82f6';
        categoriesRow.style.borderLeft = '1px solid black';
        categoriesRow.style.borderRight = '1px solid black';

        const td1 = makeHeaderTd('Pack Group');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('Active Packers');
        td2.title = 'Detected using the below pack data';
        td2.style.cursor = 'help';
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Planned Packers');
        categoriesRow.appendChild(td3);
        const td4 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td4);
        const td5 = makeHeaderTd('Deviation');
        categoriesRow.appendChild(td5);
        packTable.appendChild(categoriesRow);

        return packTable;
    }

    function loadPickTableData() {
        activePickersTotal = 0;
        setPickersTotal = 0;
        activeMultisTotal = 0;
        setMultisTotal = 0;
        activeSinglesTotal = 0;
        setSinglesTotal = 0;

        const ceTable = document.getElementById('ce-table');
        getCePaths().forEach(pp => {
            ceTable.appendChild(makeCeRow(pp));
        });

        const tsoTable = document.getElementById('tso-table');
        getTsoPaths().forEach(pp => {
            tsoTable.appendChild(makeOtherRow(pp));
        })

        const vretsTable = document.getElementById('vrets-table');
        getVretsPaths().forEach(pp => {
            vretsTable.appendChild(makeOtherRow(pp));
        })
    }

    function makeCeRow(pp) {
        const row = document.createElement('tr');
        const setData = getSetData(pp);
        const { openBatchQuantityLimit, pickRateAverage, status, unitRateTarget } = setData;
        const setPra = pickRateAverage;
        const setTur = unitRateTarget;

        const activePathData = activeData[pp];
        const { PickerCount, UnitsPerHour } = activePathData;
        const activeTur = UnitsPerHour;

        // name of path
        const ppTd = makeLinkTd(pp);
        ppTd.style.textAlign = 'left';
        row.appendChild(ppTd);

        // batch data
        if (pp.includes('Multi') && !pp.includes('MultiCASEPallet')) {
            const batchLimit = openBatchQuantityLimit;
            const activeBatches = getActiveBatches(pp);
            row.appendChild(makeTd(`${batchLimit}/${activeBatches}`));
        } else {
            row.appendChild(makeTd(''));
        }

        // active pickers
        row.appendChild(makeTd(PickerCount));

        //do not count HOV pickers or MultiCASEPallet as part of active picker total
        if (!pp.includes('HOV') || !pp.includes('MultiCASEPallet')) {
            activePickersTotal += PickerCount;
        }

        // planned pickers
        let setPickers;
        if ( setPra === 0 || setTur === 0) {
            setPickers = 0;
        } else {
            // take 10 off of TUR as set pickers will round up and this will offset over counting by 1 from testing
            setPickers = Math.ceil((parseInt(setTur - Math.floor(setPra * 0.9)))/setPra); //api does not have planned pickers so it is calculated by TUR/pick rate average
        }
        row.appendChild(makeTd(setPickers));

        //do not count pp in planned pickers total if it's an HOV path or MultiCASEPallet as default hc is 10 which is always inaccurate
        if (!pp.includes('HOV') || !pp.includes('MultiCASEPallet')) {
            setPickersTotal += parseInt(setPickers);
        } 

        if (!pp.includes('HOV') && !pp.includes('Multi')) {
            setSinglesTotal += parseInt(setPickers);
            activeSinglesTotal += PickerCount;
        }

        // delta
        const delta = PickerCount - setPickers;
        const deltaTd = makeTd(delta);
        deltaTd.textContent === 0 ? deltaTd.style.backgroundColor = '#22c55e' : deltaTd.style.backgroundColor = '#f87171';
        row.appendChild(deltaTd);

        // deviation percentage
        const deviation = getDeviationPercent(PickerCount, setPickers);
        row.appendChild(makeTd(deviation));

        row.appendChild(makeTd(activeTur));

        const turTd = makeTd(setTur);
        if (pp.includes('PPHOV') || pp.includes('MultiCASEPallet')) {
            turTd.textContent == 1000 ? turTd.style.backgroundColor = '#22c55e' : turTd.style.backgroundColor = '#f87171';
            turTd.title = 'SW for all HOV paths is to set PRA/TUR to 100/1000. If set properly, TUR will highlight green; red if not set correctly';
            turTd.style.cursor = 'help';
        }
        row.appendChild(turTd);

        //api does not contain actual rate. it is calculated by UPH/active pickers
        const activePra = getActualRate(activeTur, PickerCount);
        row.appendChild(makeTd(activePra));
        row.appendChild(makeTd(setPra));

        const statusTd = makeTd(status);
        statusTd.style.color = 'white';
        statusTd.textContent === 'Active' ? statusTd.style.backgroundColor = '#22c55e' : statusTd.style.backgroundColor = 'red';
        row.appendChild(statusTd);

        return row;
    }

    function makeOtherRow(pp) {
        const row = document.createElement('tr');
        const setData = getSetData(pp);
        const { openBatchQuantityLimit, pickRateAverage, status, unitRateTarget } = setData;
        const setPra = pickRateAverage;
        const setTur = unitRateTarget;

        const activePathData = activeData[pp];
        const { PickerCount, UnitsPerHour } = activePathData;
        const activeTur = UnitsPerHour;

        // name of path
        const ppTd = makeLinkTd(pp);
        ppTd.style.textAlign = 'left';
        row.appendChild(ppTd);

        // batch data
        if (pp.includes('Multi') && !pp.includes('MultiCASEPallet')) {
            const batchLimit = openBatchQuantityLimit;
            const activeBatches = getActiveBatches(pp);
            row.appendChild(makeTd(`${batchLimit}/${activeBatches}`));
        } else {
            row.appendChild(makeTd(''));
        }

        // active pickers
        row.appendChild(makeTd(PickerCount));

        //do not count HOV pickers or MultiCASEPallet as part of active picker total
        if (!pp.includes('HOV') || !pp.includes('MultiCASEPallet')) {
            activePickersTotal += PickerCount;
        }

        // planned pickers
        let setPickers;
        if (setTur === 0) {
            setPickers = 0;
        } else if (setPra === 0) {
            setPickers = 1;
        } else {
            // take 10 off of TUR as set pickers will round up and this will offset over counting by 1 from testing
            setPickers = Math.ceil((parseInt(setTur - Math.floor(setPra * 0.9)))/setPra); //api does not have planned pickers so it is calculated by TUR/pick rate average
        }
        row.appendChild(makeTd(setPickers));

        //do not count pp in planned pickers total if it's an HOV path or MultiCASEPallet as default hc is 10 which is always inaccurate
        if (!pp.includes('HOV') || !pp.includes('MultiCASEPallet')) {
            setPickersTotal += parseInt(setPickers);
        } 

        if (!pp.includes('HOV') && !pp.includes('Multi')) {
            setSinglesTotal += parseInt(setPickers);
            activeSinglesTotal += PickerCount;
        }

        // delta
        const delta = PickerCount - setPickers;
        const deltaTd = makeTd(delta);
        deltaTd.textContent === 0 ? deltaTd.style.backgroundColor = '#22c55e' : deltaTd.style.backgroundColor = '#f87171';
        row.appendChild(deltaTd);

        // deviation percentage
        const deviation = getDeviationPercent(PickerCount, setPickers);
        row.appendChild(makeTd(deviation));

        row.appendChild(makeTd(activeTur));

        const turTd = makeTd(setTur);
        row.appendChild(turTd);

        const statusTd = makeTd(status);
        statusTd.style.color = 'white';
        statusTd.textContent === 'Active' ? statusTd.style.backgroundColor = '#22c55e' : statusTd.style.backgroundColor = 'red';
        row.appendChild(statusTd);

        return row;
    }

    function makeLinkTd(pp) {
        const td = document.createElement('td');
        td.classList.add('row-td');

        
        const a = document.createElement('a');
        a.textContent = pp;
        a.href = `https://process-path.na.picking.aft.a2z.com/fc/${fc}/properties/process-path/${pp}`;
        td.appendChild(a);

        return td;
    }

    // returns an object with all set data
    function getSetData(pp) {
        for (let path of setData) {
            if (path.processPathName === pp) {
                return path;
            }
        }
    }

    function getActiveBatches(pp) {
        let batchCount = 0;
        for (let batch of batchData) {
            if (batch.processPath === pp) {
                batchCount++;
            }
        }

        return batchCount;
    }

    function loadPackTableData() {
        const packTable = document.getElementById('pack-table');
        for (const [key, value] of Object.entries(packHeadcounts)) {
            if (!value || value === 0) {
                continue;
            }
            const tr = makePackTableRow(key, value);
            packTable.appendChild(tr);
        }
    }

    function getActualRate(tur, activePickers) {
        if (parseInt(tur) === 0 || activePickers === 0) {
            return 'N/A';
        }
        return Math.round(parseInt(tur) / parseInt(activePickers));
    }

    function makePackTableRow(packGroup, hc) {
        const tr = document.createElement('tr');
        const name = makeTd(packGroup);
        tr.appendChild(name);

        const activePackersTd = makeTd(hc);
        tr.appendChild(activePackersTd);

        let plannedPackers = 0;
        if (localStorage.getItem(`${fc}-${packGroup}`)) {
            plannedPackers = localStorage.getItem(`${fc}-${packGroup}`);
        }

        const plannedPackersTd = makeInputTd(packGroup);
        tr.appendChild(plannedPackersTd);

        const delta = hc - plannedPackers;
        const deltaTd = makeTd(delta);
        deltaTd.style.backgroundColor = delta === 0 ? '#22c55e' : '#f87171';
        tr.appendChild(deltaTd);

        const deviationPercent = getDeviationPercent(hc, plannedPackers);
        const deviationTd = makeTd(deviationPercent);
        tr.appendChild(deviationTd);

        return tr;
    }

    function makeTd(data) {
        const td = document.createElement('td');
        td.textContent = data;

        return td;
    }

    // use local storage to load in saved plan pack hc so don't have to reenter upon refresh
    // if no local storage for that pack group exists, use 0
    // when user changes the input, automatically save new input in local storage
    // the key is saved as fc-packGroup as leads run multiple sites
    function makeInputTd(packGroup) {
        const td = document.createElement('td');
        const input = document.createElement('input');
        if (localStorage.getItem(`${fc}-${packGroup}`)) {
            input.value = localStorage.getItem(`${fc}-${packGroup}`);
        } else {
            input.value = 0;
        }

        input.addEventListener('change', (e) => {
            localStorage.setItem(`${fc}-${packGroup}`, e.target.value);
        })
        td.appendChild(input);

        return td;
    }

    function makeHeaderTd(str) {
        const td = document.createElement('td');
        td.classList.add('header-td');
        td.textContent = str;
        return td;
    }

    function getDeviationPercent(activePackers, plannedPackers) {
        if (activePackers == 0) {
            return '100%';
        }
        const deviationPercent = ((plannedPackers - activePackers) / plannedPackers) * 100 * -1;
        return `${deviationPercent > 0 ? '+' : ''}${deviationPercent.toFixed(0)}%`;
    }

    function makeLi(list, pp) {
        const li = document.createElement('li');
        if (list.id === 'all-paths-list') {
            li.textContent = pp;
            li.addEventListener('click', () => {
                if (!li.classList.contains('free-selected')) {
                    li.classList.add('free-selected');
                    li.style.backgroundColor = 'blue';
                    li.style.color = 'white';
                    freeSelectedPaths.push(pp);
                    freeSelectedPaths.sort((a, b) => a > b);
                } else {
                    li.classList.remove('free-selected');
                    li.style.backgroundColor = 'white';
                    li.style.color = 'black';
                    freeSelectedPaths.splice(freeSelectedPaths.indexOf(pp), 1);
                }
            })
        } else if (list.id === 'current-ce-paths') {
            li.textContent = pp;
            li.addEventListener('click', () => {
                if (!li.classList.contains('ce-selected')) {
                    li.classList.add('ce-selected');
                    li.style.backgroundColor = 'blue';
                    li.style.color = 'white';
                    ceSelectedPaths.push(pp);
                    ceSelectedPaths.sort((a, b) => a > b);
                } else {
                    li.classList.remove('ce-selected');
                    li.style.backgroundColor = 'white';
                    li.style.color = 'black';
                    ceSelectedPaths.splice(ceSelectedPaths.indexOf(pp), 1);
                }
            })
        } else if (list.id === 'current-tso-paths') {
            li.textContent = pp;
            li.addEventListener('click', () => {
                if (!li.classList.contains('tso-selected')) {
                    li.classList.add('tso-selected');
                    li.style.backgroundColor = 'blue';
                    li.style.color = 'white';
                    tsoSelectedPaths.push(pp);
                    tsoSelectedPaths.sort((a, b) => a > b);
                } else {
                    li.classList.remove('tso-selected');
                    li.style.backgroundColor = 'white';
                    li.style.color = 'black';
                    tsoSelectedPaths.splice(tsoSelectedPaths.indexOf(pp), 1);
                }
            })
        } else if (list.id === 'current-vrets-paths') {
            li.textContent = pp;
            li.addEventListener('click', () => {
                if (!li.classList.contains('vrets-selected')) {
                    li.classList.add('vrets-selected');
                    li.style.backgroundColor = 'blue';
                    li.style.color = 'white';
                    vretsSelectedPaths.push(pp);
                    vretsSelectedPaths.sort((a, b) => a > b);
                } else {
                    li.classList.remove('vrets-selected');
                    li.style.backgroundColor = 'white';
                    li.style.color = 'black';
                    vretsSelectedPaths.splice(vretsSelectedPaths.indexOf(pp), 1);
                }
            })
        }

        li.style.cssText += `
            list-style: none;
            padding-top: 0.2rem;
            padding-bottom: 0.2rem;
        `
        li.onmouseover = li.style.cursor = 'pointer';

        return li;
    }

    /*-----------------/
    -DOM element logic-
    /----------------*/

    function openSettings() {
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

    function closeSettings() {
        const overlay = document.getElementById('overlay');
        overlay.style.display = 'none';

        // reset div for updated data
        const masterDiv = document.getElementById('master-div');
        const pickDiv = document.getElementById('pick-div');
        pickDiv.remove();
        const newPickDiv = makePickDiv();
        newPickDiv.setAttribute('id', 'pick-div');
        masterDiv.prepend(newPickDiv);
        loadPickTableData();
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

    function loadAllFreePaths(list) {
        for (const pp in activeData) {
            if (!isCurrentPath(pp)) {
                list.appendChild(makeLi(list, pp));
            }
        }
    }

    function isCurrentPath(pp) {
        const cePaths = getCePaths();
        const tsoPaths = getTsoPaths();
        const vretsPaths = getVretsPaths();
        if (cePaths.indexOf(pp) !== -1) { 
            return true;
        }
        if (tsoPaths.indexOf(pp) !== -1) {
            return true;
        }
        if (vretsPaths.indexOf(pp) !== -1) {
            return true;
        }
        return false;
    }

    /*
    lists should first check if there is a selected value, otherwise do nothing
    if there is a value, update the appropriate local storage to include this
    take that path out of all paths list by checking against local storage
    update current paths for that path by checking against local storage
    */
    function addToCEList() {
        if (freeSelectedPaths === undefined || freeSelectedPaths.length === 0) {
            return;
        }
        addCePath(freeSelectedPaths);
        // clear selected paths array
        freeSelectedPaths.length = 0;
        updateCurrentLists();
    }

    function addCePath(freeSelectedPaths) {
        const currentCePaths = getCePaths();
        freeSelectedPaths.forEach(pp => currentCePaths.push(pp));
        localStorage.setItem(`${fc}-ce`, JSON.stringify(currentCePaths));
    }

    function addToTSOList() {
        if (freeSelectedPaths === undefined || freeSelectedPaths.length === 0) {
            return;
        }
        addTsoPath(freeSelectedPaths);
        // clear selected paths array
        freeSelectedPaths.length = 0;
        updateCurrentLists();
    }

    function addTsoPath(freeSelectedPaths) {
        const currentTsoPaths = getTsoPaths();
        freeSelectedPaths.forEach(pp => currentTsoPaths.push(pp));
        localStorage.setItem(`${fc}-tso`, JSON.stringify(currentTsoPaths));
    }

    function addToVretsList() {
        if (freeSelectedPaths === undefined || freeSelectedPaths.length === 0) {
            return;
        }
        addVretsPath(freeSelectedPaths);
        // clear selected paths array
        freeSelectedPaths.length = 0;
        updateCurrentLists();
    }

    function addVretsPath(freeSelectedPaths) {
        const currentVretsPaths = getVretsPaths();
        freeSelectedPaths.forEach(pp => currentVretsPaths.push(pp));
        localStorage.setItem(`${fc}-vrets`, JSON.stringify(currentVretsPaths));
    }

    // remove old DOM elements and insert updated ones. React would be nice to have here
    function updateCurrentLists() {
        // reset the selected arrays
        freeSelectedPaths.length =0;
        ceSelectedPaths.length = 0;
        tsoSelectedPaths.length = 0;
        vretsSelectedPaths.length = 0;
        const overlay = document.getElementById('overlay');
        const settingsDiv = document.getElementById('settings-div');
        settingsDiv.remove();

        const updatedSettingsDiv = makeSettingsDiv();
        overlay.appendChild(updatedSettingsDiv);
    }

    function removeCurrentPaths() {
        for (let i = 0; i < ceSelectedPaths.length; i++) {
            removeCePath(ceSelectedPaths[i]);
        }
        for (let i = 0; i < tsoSelectedPaths.length; i++) {
            removeTsoPath(tsoSelectedPaths[i]);
        }
        for (let i = 0; i < vretsSelectedPaths.length; i++) {
            removeVretsPath(vretsSelectedPaths[i]);
        }

        updateCurrentLists();
    }

}

/*
    current is settings div 
*/


/* to dos

display pick table
add flags if noncon processed in BOD or vice versa
add auto refresh

*/
