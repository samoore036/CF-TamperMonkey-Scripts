// ==UserScript==
// @name         ppa calc
// @updateURL    https://github.com/samoore036/CF-TamperMonkey-Scripts/tree/main/cpt%20puller
// @downloadURL  https://github.com/samoore036/CF-TamperMonkey-Scripts/tree/main/cpt%20puller
// @namespace    https://github.com/samoore036/CF-TamperMonkey-Scripts
// @version      2.1
// @description  Pull planned hcs/rates and compare against ppa
// @author       mooshahe
// @match        https://fclm-portal.amazon.com/ppa/inspect/*
// @grant        GM.xmlHttpRequest
// @connect      ecft.fulfillment.a2z.com
// ==/UserScript==


const usingChrome = navigator.userAgent.includes("Chrome") ? true : false

if (usingChrome) {
    /* very first thing is to check browser. if it is Chrome, do not run the script.
    the planner uses Chrome to run selenium so if the plugin is ran through Chrome there could
    potentially be way more calls than necessary since the planner opens PPA for rate pulls
    */
    console.log("You are using Chrome. This plugin only works with Firefox")
    return
} else {
    runScript()
}

function runScript() {

    /****************\
    |global variables|
    \****************/
    let fc = document.getElementById("WarehouseSelector").value;

    // fc value changes when user selects a different warehouse through the selector
    const selector = document.getElementById("WarehouseSelector")
    selector.addEventListener("change", e => {
        fc = e.target.value
        console.log(`fc is now ${fc}`)
    })
    const planTimes = [];
    let plannedTotal = 0;
    let actualTotal = 0;
    let deltaTotal = 0;
    let plannedCapacityTotal = 0;
    let actualCapacityTotal = 0;
    let capacityDeltaTotal = 0;
    const summaryPaths = {
        paths: [],
        plannedHcs: 0,
        actualHcs: 0,
        plannedCapacity: 0,
        actualCapacity: 0
    }

    // used to alternate row colors
    let rowCount = 0;

    setupDom();
    
    
    // check if the slam pad time is stored in local storage. if not then prompt user to enter the schedule
    // keys are stored as fc and values are the slam pad time in minutes
    if (!localStorage.getItem(`${fc}`)) {
        loadSubmitButtons();
        loadSettingsButton();
        openModal();
    } else {
        loadSubmitButtons();
        loadTimeDisplayDiv();
        loadSettingsButton();
        // only load table data if it's not already loaded in
        if (document.getElementById('table-div')) {
            return;
            
        } else {
                loadTableData();
        }
    }

    /****************\
    |DOM manipulation|
    \****************/

    function setupDom() {
        const overlay = makeOverlay();
        overlay.appendChild(makeModal());
        document.body.appendChild(overlay);
    }

    function makeOverlay() {
        const overlay = document.createElement('div');
        overlay.setAttribute('id', 'overlay');
        overlay.style.display = 'none';

        return overlay;
    }

    function makeModal() {
        const modal = document.createElement('div');
        modal.setAttribute('id', 'modal');
        modal.style.cssText += `background-color: white; color: black; padding: 3rem; font-size: 1.4rem; max-height: 100vh; overflow-y: auto;`;
        
        const prompt = document.createElement('p');
        prompt.textContent = `Please enter period/quarter start/end times`;
        prompt.style.cssText+= 'font-size: 1.4rem; text-align: center;';
        modal.appendChild(prompt);

        const advisory = document.createElement('p');
        advisory.textContent = `Times should be in 24hr format i.e. 07:30, 15:30, 00:30, 03:45`;
        advisory.style.cssText+= 'font-size: 1.3rem; text-align: center;';
        modal.appendChild(advisory); 

        const masterInputDiv = document.createElement("div")
        masterInputDiv.setAttribute("id", "master-input-div")
        masterInputDiv.style.cssText += 'display: flex; flex-direction: column;'
        modal.appendChild(masterInputDiv)

        // used to auto select day or night times
        const date = new Date()
        let dayshiftSelect = true
        if (date.getHours() > 17 || date.getHours() < 6) {
            !dayshiftSelect
        }

        const shiftDiv = document.createElement("div")
        shiftDiv.style.cssText += 'display: flex; justify-content: space-around; margin-top: 1rem; margin-bottom: 1rem; border: 2px solid black;'
        masterInputDiv.appendChild(shiftDiv)

        const dayShiftButton = document.createElement("div")
        dayShiftButton.textContent = "Dayshift"
        dayShiftButton.setAttribute("id", "dayshift-btn")
        dayShiftButton.style.cssText += "cursor: pointer; font-size: 1.7rem; width: 50%; text-align: center;"
        if (dayshiftSelect) {
            dayShiftButton.style.backgroundColor = "gray"
        }
        shiftDiv.appendChild(dayShiftButton)

        const nightShiftButton = document.createElement("div")
        nightShiftButton.textContent = "Nightshift"
        nightShiftButton.style.cssText += "cursor: pointer; font-size: 1.7rem; width: 50%; text-align: center;"
        if (!dayshiftSelect) {
            nightShiftButton.style.backgroundColor = "gray"
        }
        shiftDiv.appendChild(nightShiftButton)

        const dayshiftTimeDiv = document.createElement('div');
        dayshiftTimeDiv.setAttribute('id', 'dayshift-modal-input-div');
        dayshiftTimeDiv.style.cssText += `flex-direction: column; gap: 2rem;`
        for (let i = 1; i < 6; i++) {
            dayshiftTimeDiv.appendChild(makeTimeInputDiv(i, 'ds'));
        }
        if (dayshiftSelect) {
            dayshiftTimeDiv.style.display = "flex"
        } else {
            dayshiftTimeDiv.style.display = "none"
        }
        masterInputDiv.appendChild(dayshiftTimeDiv);

        const nightshiftTimeDiv = document.createElement('div');
        nightshiftTimeDiv.setAttribute('id', 'nightshift-modal-input-div');
        nightshiftTimeDiv.style.cssText += `flex-direction: column; gap: 2rem;`
        for (let i = 1; i < 6; i++) {
            nightshiftTimeDiv.appendChild(makeTimeInputDiv(i, 'ns'));
        }
        if (!dayshiftSelect) {
            nightshiftTimeDiv.style.display = "flex"
        } else {
            nightshiftTimeDiv.style.display = "none"
        }
        masterInputDiv.appendChild(nightshiftTimeDiv);

        dayShiftButton.addEventListener('click', () => {
            dayShiftButton.style.backgroundColor = "gray"
            nightShiftButton.style.backgroundColor = "white"
            dayshiftTimeDiv.style.display = "flex"
            nightshiftTimeDiv.style.display = "none"
        })
        nightShiftButton.addEventListener('click', () => {
            dayShiftButton.style.backgroundColor = "white"
            nightShiftButton.style.backgroundColor = "gray"
            dayshiftTimeDiv.style.display = "none"
            nightshiftTimeDiv.style.display = "flex"
        })
        
        const buttonDiv = document.createElement('div');
        buttonDiv.style.cssText += `display: flex; gap: 2rem; align-self: center;`;


        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.style.cssText += `
            align-self: center; width: 15rem; margin-top: 1rem;
            color: black; background-color: white; font-size: 1.5rem;
        `
        saveButton.addEventListener('click', saveModalSettings);
        buttonDiv.appendChild(saveButton);

        const exitButton = document.createElement('button');
        exitButton.textContent = 'Exit';
        exitButton.style.cssText += `
            align-self: center; width: 15rem; margin-top: 1rem;
            color: black; background-color: rgb(220, 38, 38); font-size: 1.5rem;
        `
        exitButton.addEventListener('click', closeModal);
        buttonDiv.appendChild(exitButton);

        masterInputDiv.appendChild(buttonDiv);

        return modal;
    }

    function loadSubmitButtons() {
        const parent = document.querySelector('.cp-submit-row');
        makeSubmitButtons(parent);
    }

    function loadTimeDisplayDiv() {
        const parent = document.querySelector('.cp-submit-row');
        parent.prepend(makeTimeDisplayDiv());
    }

    function loadSettingsButton() {
        const parent = document.querySelector('.cp-submit-row');
        parent.prepend(makeSettingsBtn());
    }

    function makeTimeDisplayDiv() {
        const div = document.createElement('div');
        div.setAttribute('id', 'time-display-div');
        div.style.cssText += `display: flex; flex-direction: column; justify-content: space-between; gap: 0.5rem;`;

        const dateButtonTray = document.createElement('div');
        dateButtonTray.style.cssText += `display: flex; gap: 0.1rem;`;
        loadDateButtons(dateButtonTray);

        const dayshifTimeButtonTray = document.createElement('div');
        dayshifTimeButtonTray.style.cssText += `display: flex; gap: 0.1rem;`;
        loadTimeButtons(dayshifTimeButtonTray, 'ds');

        const nightshifTimeButtonTray = document.createElement('div');
        nightshifTimeButtonTray.style.cssText += `display: flex; gap: 0.1rem;`;
        loadTimeButtons(nightshifTimeButtonTray, 'ns');

        div.appendChild(dateButtonTray);
        div.appendChild(dayshifTimeButtonTray);
        div.appendChild(nightshifTimeButtonTray)

        return div;
    }

    function makeSettingsBtn() {
        const settingsDiv = document.createElement('div');
        settingsDiv.setAttribute('id', 'schedule-settings-button');
        settingsDiv.style.cssText += `align-self: end;`;
        const settingsBtn = document.createElement('button');
        settingsBtn.textContent = 'Change Schedule Settings';
        settingsBtn.type = 'button'; // type necessary to prevent submitting as it is technically in a form
        settingsBtn.addEventListener('click', openModal);
        settingsDiv.appendChild(settingsBtn);

        return settingsDiv;
    }

    // adds submit form buttons that will load the correct displayed info for parsing correctly
    function makeSubmitButtons(submitDiv) {
        submitDiv.prepend(makeSubmitButton('Go to rebin'));
        submitDiv.prepend(makeSubmitButton('Go to pack'));
        submitDiv.prepend(makeSubmitButton('Go to pick'));
    }

    /*************\
    |DOM factories|
    \*************/
    
    function makeTimeInputDiv(number, shift) {
        const div = document.createElement('div');
        div.style.cssText += `display:flex; gap: 2rem;`;

        const titleDiv = document.createElement('div');
        titleDiv.textContent = `P/Q${number}`;
        titleDiv.style.cssText += `display: flex; justify-content: center; align-items: end; margin-bottom: 3px;`
        div.appendChild(titleDiv);

        const startDiv = document.createElement('div');
        const startPrompt = document.createElement('div');
        startPrompt.textContent = 'Start time:';
        startDiv.appendChild(startPrompt);
        const startInput = document.createElement('input');
        startInput.style.color = 'black';
        startInput.placeholder = 'ex: 07:30';
        let startFirstTime = true
        startInput.addEventListener('input', (e) => {
            if (startInput.value.length < 2) {
                startFirstTime = true
            }
            if (startInput.value.length == 2 && startFirstTime) {
                startInput.value += ":"
                startFirstTime = false
            }
        })
        startDiv.appendChild(startInput);
        div.appendChild(startDiv);
        if (getUserTimes()) {
            if (getUserTimes()[`${shift}_start${number}`]) {
                startInput.value = getUserTimes()[`${shift}_start${number}`];
            }
        }

        const endDiv = document.createElement('div');
        const endPrompt = document.createElement('div');
        endPrompt.textContent = 'End time:';
        endDiv.appendChild(endPrompt);
        const endInput = document.createElement('input');
        endInput.style.color = 'black';
        endInput.placeholder = 'ex: 09:45';
        let endFirstTime = true
        endInput.addEventListener('input', (e) => {
            if (endInput.value.length < 2) {
                endFirstTime = true
            }
            if (endInput.value.length == 2 && endFirstTime) {
                endInput.value += ":"
                endFirstTime = false
            }
        })
        endDiv.appendChild(endInput);
        div.appendChild(endDiv);
        if (getUserTimes()) {
            if (getUserTimes()[`${shift}_end${number}`]) {
                endInput.value = getUserTimes()[`${shift}_end${number}`];
            }
        }

        return div;
    }

    function makeDateButton(name) {
        const button = document.createElement('button');
        button.textContent = name;
        button.style.cssText += `
            border: 2px solid #2e6da4; background-color: #337ab7; color: white;
            padding: 6px 12px; 
        `
        button.type = 'button';

        const today = new Date();
        const startDate = document.getElementById('startDateIntraday');
        const endDate = document.getElementById('endDateIntraday');
        if (name === 'Today') {
            const year = today.getFullYear();
            const month = today.getMonth() + 1 < 10 ? `0${today.getMonth() + 1}` : today.getMonth() + 1;
            const day = today.getDate() < 10 ? `0${today.getDate()}` : today.getDate();
            button.addEventListener('click', () => {
                startDate.value = `${year}/${month}/${day}`;
                endDate.value = `${year}/${month}/${day}`;
            })
        } else if (name === 'Yesterday') {
            today.setDate(today.getDate() - 1);
            const year = today.getFullYear();
            const month = today.getMonth() + 1 < 10 ? `0${today.getMonth() + 1}` : today.getMonth() + 1;
            const day = today.getDate() < 10 ? `0${today.getDate()}` : today.getDate();
            button.addEventListener('click', () => {
                startDate.value = `${year}/${month}/${day}`;
                endDate.value = `${year}/${month}/${day}`;
            })
        } else {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterYear = yesterday.getFullYear();
            const yesterMonth = yesterday.getMonth() + 1 < 10 ? `0${yesterday.getMonth() + 1}` : yesterday.getMonth() + 1;
            const yesterDay = yesterday.getDate() < 10 ? `0${yesterday.getDate()}` : yesterday.getDate();

            const year = today.getFullYear();
            const month = today.getMonth() + 1 < 10 ? `0${today.getMonth() + 1}` : today.getMonth() + 1;
            const day = today.getDate() < 10 ? `0${today.getDate()}` : today.getDate();

            button.addEventListener('click', () => {
                startDate.value = `${yesterYear}/${yesterMonth}/${yesterDay}`;
                endDate.value = `${year}/${month}/${day}`;
            })
        }

        return button;
    }

    function makeTimeButton(name, i, shift) {
        const button = document.createElement('button');
        button.textContent = name;
        button.style.cssText += `
            border: 2px solid #2e6da4; background-color: #337ab7; color: white;
            padding: 6px 12px; 
        `
        button.type = 'button';

        if (i) {
            button.addEventListener('click', () => {
                const startHour = getUserTimes()[`${shift}_start${i}`].split(':')[0];
                const startMinute = getUserTimes()[`${shift}_start${i}`].split(':')[1];
                const endHour = getUserTimes()[`${shift}_end${i}`].split(':')[0];
                const endMinute = getUserTimes()[`${shift}_end${i}`].split(':')[1];
                document.getElementById('startHourIntraday').selectedIndex = startHour;
                document.getElementById('startMinuteIntraday').selectedIndex = getSelectIndexMinute(startMinute);
                document.getElementById('endHourIntraday').selectedIndex = endHour;
                document.getElementById('endMinuteIntraday').selectedIndex = getSelectIndexMinute(endMinute);
            })
        }
            
        return button;
    }

    function makeSubmitButton(category) {
        const button = document.createElement('button');
        button.textContent = category;
        button.style.cssText += `
            border: 1px solid #ccc; background-color: white; color: black; font-size: 12px;
            padding: 3px 6px; margin-left: 1em; margin-top: 1rem;
        `
        button.type = 'button';
        if (category.includes('pick')) {
            button.addEventListener('click', goToPick);
        } else if (category.includes('pack')) {
            button.addEventListener('click', goToPack);
        } else if (category.includes('rebin')) {
            button.addEventListener('click', goToRebin);
        }
            
        return button;
    }

    // three buttons: yesterday, today, yesterday to today
    function loadDateButtons(dateButtonTray) {
        const yesterday = makeDateButton('Yesterday');
        dateButtonTray.appendChild(yesterday);

        const today = makeDateButton('Today');
        dateButtonTray.appendChild(today);

        const yesterdayAndToday = makeDateButton('Yesterday to Today');
        dateButtonTray.appendChild(yesterdayAndToday);
    }

    function loadTimeButtons(timeButtonTray, shift) {
        // first determine if periods or quarters by checking fourth time. if this is null, it's periods, otherwise quarters
        let isPeriods = true;
        const userTimes = getUserTimes();
        if (userTimes[`${shift}_start4`] && userTimes[`${shift}_end4`]) {
            isPeriods = false;
        }

        for (let i = 1; i < 6; i++) {
            const title = isPeriods ? `${shift.toUpperCase()} Period` : `${shift.toUpperCase()} Quarter`;
            const start = userTimes[`${shift}_start${i}`];
            const end = userTimes[`${shift}_end${i}`];
            if (start && end) {
                timeButtonTray.appendChild(makeTimeButton(`${title}${i}`, i, shift));
            }
        }
    }

    function getSelectIndexMinute(minutes) {
        switch(minutes) {
            case '15': return 1;
            case '30': return 2;
            case '45': return 3;
            default: return 0;
        }
    }

    function makeHeaderTd(str) {
        const td = document.createElement('td');
        td.textContent = str;
        td.style.cssText += `
            padding: 2px 16px;
            font-size: 14px;
            font-weight: bold;
            line-height: 20px;
        `

        return td;
    }

    function makeTd(data) {
        const td = document.createElement('td');
        td.textContent = data;
        td.style.cssText += `
            border: 1px solid black;
            padding: 2px 12px;
            font-size: 16px;
            text-align: center;
        `

        return td;
    }

    // make red if delta is -10% to planned
    function makeDeltaTd(planned, actual) {
        const delta = actual - planned;
        const diff = planned * -.10;
        const td = document.createElement('td');
        td.textContent = delta.toFixed(1);
        td.style.cssText += `
            border: 1px solid black;
            padding: 2px 12px;
            font-size: 16px;
            background-color: ${delta <= diff ? 'rgb(248, 113, 113)' : 'none'};
        `
        if (delta <= diff) {
            td.style.cssText += `cursor: help`;
            td.title = 'Deviating more than 10% under to plan';
        }

        return td;
    }

    function makeInputTd(id) {
        const td = document.createElement('td');
        td.style.cssText += `
            border: 1px solid black; background-color: yellow;
        `
        const input = document.createElement('input');
        input.setAttribute('id', `${id}-input`);
        input.style.cssText += `
            font-size: 16px;
            height: 2.3rem;
            width: 7rem;
            text-align: center;
        `
        td.appendChild(input);
    
        return td;
    }

    function makeHcRow(pathName, processPath) {
        const row = document.createElement('tr');
        row.style.backgroundColor = rowCount % 2 === 0 ? 'white' : '#e5e7eb';

        const ppTd = makeTd(pathName);
        ppTd.classList.add("pp")
        ppTd.style.cssText += `padding-left: 0.3rem; padding-right: 0.5rem; text-align: left; cursor: pointer;`
        row.appendChild(ppTd);

        row.appendChild(makeTd(processPath.planned_hc));
        plannedTotal += processPath.planned_hc;
        const actualHc = parseFloat(parseFloat(processPath.actual_hc) / getTimeDiff().toFixed(1));
        row.appendChild(makeTd(actualHc.toFixed(1)));
        actualTotal += actualHc;
        row.appendChild(makeDeltaTd(processPath.planned_hc, actualHc));
        deltaTotal += actualHc - processPath.planned_hc;

        ppTd.addEventListener('click', (e) => addToSummary(e, pathName, processPath))

        rowCount++;
        return row;
    }

    function makeRateRow(pathName, processPath) {
        const row = document.createElement('tr');
        row.style.backgroundColor = rowCount % 2 === 0 ? 'white' : '#e5e7eb';

        const ppTd = makeTd(pathName);
        ppTd.classList.add("pp")
        ppTd.style.cssText += `padding-left: 0.3rem; padding-right: 0.5rem; text-align: left; cursor: pointer;`
        row.appendChild(ppTd);

        row.appendChild(makeTd(processPath.planned_rate));
        row.appendChild(makeTd(processPath.actual_rate));
        row.appendChild(makeDeltaTd(processPath.planned_rate, processPath.actual_rate));

        ppTd.addEventListener('click', (e) => addToSummary(e, pathName, processPath))

        rowCount++;
        return row;
    }

    function makeCapacityRow(pathName, processPath) {
        const row = document.createElement('tr');
        row.style.backgroundColor = rowCount % 2 === 0 ? 'white' : '#e5e7eb';

        const ppTd = makeTd(pathName);
        ppTd.classList.add("pp")
        ppTd.style.cssText += `padding-left: 0.3rem; padding-right: 0.5rem; text-align: left; cursor: pointer;`
        row.appendChild(ppTd);

        const plannedCapacity = processPath.planned_rate * processPath.planned_hc * getTimeDiff();
        plannedCapacityTotal += plannedCapacity;
        row.appendChild(makeTd(plannedCapacity.toFixed(1)));

        const actualCapacity = processPath.actual_rate * processPath.actual_hc;
        actualCapacityTotal += actualCapacity;
        row.appendChild(makeTd(actualCapacity.toFixed(0)));

        const capacityDelta = actualCapacity - plannedCapacity;
        capacityDeltaTotal += capacityDelta;
        row.appendChild(makeDeltaTd(plannedCapacity, actualCapacity));

        ppTd.addEventListener('click', (e) => addToSummary(e, pathName, processPath))

        rowCount++;
        return row;
    }

    function makeTotalRow(planned, actual, delta) {
        const row = document.createElement('tr');
        row.style.cssText += `border-top: 3px solid black;`

        const totalTd = makeTd('Total');
        totalTd.style.cssText += `padding-left: 0.3rem; padding-right: 0.5rem; text-align: left;`
        row.appendChild(totalTd);

        row.appendChild(makeTd(planned.toFixed(1)));
        row.appendChild(makeTd(actual.toFixed(1)));
        row.appendChild(makeTd(delta.toFixed(1)));

        return row;
    }

    function makeRebinHcRow(data) {
        const row = document.createElement('tr');

        row.appendChild(makeTd(data.planned_hc.toFixed(1)));
        const actualHc = parseFloat(parseFloat(data.actual_hc) / getTimeDiff());
        row.appendChild(makeTd(actualHc.toFixed(1)));
        row.appendChild(makeDeltaTd(data.planned_hc, actualHc));

        return row;
    }

    function makeRebinRateRow(data) {
        const row = document.createElement('tr');

        if (data.planned_rate) {
            row.appendChild(makeTd(data.planned_rate));
        } else {
            row.appendChild(makeInputTd('planned-rate'));
        }
        
        row.appendChild(makeTd(data.actual_rate));

        if (data.planned_rate) {
            row.appendChild(makeDeltaTd(data.planned_rate, data.actual_rate));
        } else {
            row.appendChild(makeTd('N/A'));
        }
        
        return row;
    }

    function makeRebinCapacityRow(data) {
        const row = document.createElement('tr');

        let plannedQuantity = 0;
        if (data.planned_rate) {
            plannedQuantity = data.planned_rate * data.planned_hc * getTimeDiff();
            row.appendChild(makeTd(plannedQuantity.toFixed(1)));
        } else {
            row.appendChild(makeTd('N/A'));
        }
        
        row.appendChild(makeTd(data.actual_quantity));

        if (data.planned_rate) {
            row.appendChild(makeDeltaTd(plannedQuantity, data.actual_quantity));
        } else {
            row.appendChild(makeTd('N/A'));
        }
        
        return row;
    }

    function makeManualHcRow(pathName, processPath) {
        const row = document.createElement('tr');
        row.style.backgroundColor = rowCount % 2 === 0 ? 'white' : '#e5e7eb';

        const ppTd = makeTd(pathName);
        ppTd.classList.add("pp")
        ppTd.style.cssText += `padding-left: 0.3rem; padding-right: 0.5rem; text-align: left;`
        row.appendChild(ppTd);

        if (processPath.planned_hc) {
            row.appendChild(makeTd(processPath.planned_hc));
        } else {
            row.appendChild(makeInputTd(`${pathName}-planned-hc`));
        }
        
        const actualHc = parseFloat(parseFloat(processPath.actual_hc) / getTimeDiff());
        row.appendChild(makeTd(actualHc.toFixed(1)));

        if (processPath.planned_hc) {
            row.appendChild(makeDeltaTd(processPath.planned_hc, actualHc));
        } else {
            row.appendChild(makeTd('N/A'));
        }
        
        rowCount++;
        return row;
    }

    function makeManualRateRow(pathName, processPath) {
        const row = document.createElement('tr');
        row.style.backgroundColor = rowCount % 2 === 0 ? 'white' : '#e5e7eb';

        const ppTd = makeTd(pathName);
        ppTd.classList.add("pp")
        ppTd.style.cssText += `padding-left: 0.3rem; padding-right: 0.5rem; text-align: left;`
        row.appendChild(ppTd);

        if (processPath.planned_rate) {
            row.appendChild(makeTd(processPath.planned_rate));
        } else {
            row.appendChild(makeInputTd(`${pathName}-planned-rate`));
        }
        
        row.appendChild(makeTd(processPath.actual_rate));

        if (processPath.planned_rate) {
            row.appendChild(makeDeltaTd(processPath.planned_rate, processPath.actual_rate));
        } else {
            row.appendChild(makeTd('N/A'));
        }
        
        rowCount++;
        return row;
    }

    function makeManualCapacityRow(pathName, processPath) {
        const row = document.createElement('tr');
        row.style.backgroundColor = rowCount % 2 === 0 ? 'white' : '#e5e7eb';

        const ppTd = makeTd(pathName);
        ppTd.classList.add("pp")
        ppTd.style.cssText += `padding-left: 0.3rem; padding-right: 0.5rem; text-align: left;`
        row.appendChild(ppTd);

        if (processPath.planned_quantity) {
            row.appendChild(makeTd(processPath.planned_quantity));
        } else {
            row.appendChild(makeTd(`N/A`));
        }
        
        row.appendChild(makeTd(processPath.actual_quantity));

        if (processPath.planned_quantity) {
            row.appendChild(makeDeltaTd(processPath.planned_quantity, processPath.actual_quantity));
        } else {
            row.appendChild(makeTd('N/A'));
        }
        
        rowCount++;
        return row;
    }

    function makeManualRebinHcRow(data) {
        const row = document.createElement('tr');

        if (data.planned_hc) {
            row.appendChild(makeTd(data.planned_hc));
        } else {
            row.appendChild(makeInputTd('planned-hc'));
        }
        
        const actualHc = parseFloat(parseFloat(data.actual_hc) / getTimeDiff());
        row.appendChild(makeTd(actualHc.toFixed(1)));

        if (data.planned_hc) {
            row.appendChild(makeDeltaTd(data.planned_hc, actualHc));
        } else {
            row.appendChild(makeTd('N/A'));
        }
        
        return row;
    }

    function addToSummary(e, pathName, processPath) {
        const summaryTable = document.getElementById("summary-table")
        ppTds = Array.from(document.getElementsByClassName("pp"))
        console.log(processPath)
        for (i in ppTds) {
            if (ppTds[i].textContent == pathName) {
                if (!ppTds[i].classList.contains("selected-summary")) {
                    ppTds[i].classList.add("selected-summary")
                    ppTds[i].style.backgroundColor = "#6ee7b7"
                    if (ppTds[i] == e.target) {
                        summaryPaths.plannedHcs += parseFloat(processPath.planned_hc)
                        summaryPaths.actualHcs += parseFloat(processPath.actual_hc)
                        summaryPaths.plannedCapacity += parseFloat(processPath.planned_rate * processPath.planned_hc * getTimeDiff())
                        console.log(processPath.actual_quantity)
                        summaryPaths.actualCapacity += parseInt(processPath.actual_quantity)
                    }
                } else {
                    ppTds[i].classList.remove("selected-summary")
                    ppTds[i].style.backgroundColor = ppTds[i].parentElement.style.backgroundColor
                    if (ppTds[i] == e.target) {
                        summaryPaths.plannedHcs -= parseFloat(processPath.planned_hc)
                        summaryPaths.actualHcs -= parseFloat(processPath.actual_hc)
                        summaryPaths.plannedCapacity -= parseFloat(processPath.planned_rate * processPath.planned_hc * getTimeDiff()).toFixed(1)
                        summaryPaths.actualCapacity -= processPath.actual_quantity
                    }
                    if (document.getElementsByClassName("selected-summary").length == 0) {
                        summaryPaths.plannedHcs = 0
                        summaryPaths.actualHcs = 0
                        summaryPaths.plannedCapacity = 0
                        summaryPaths.actualCapacity = 0
                    }
                }
            }
        }

        if (document.getElementsByClassName("selected-summary").length == 0) {
            if (document.getElementById("summary-table-category-row")) {
                document.getElementById("summary-table-category-row").remove()
            }
            if (document.getElementById("summary-stats")) {
                document.getElementById("summary-stats").remove()
            }

            const yellowPromptRow = document.createElement('tr')
            yellowPromptRow.setAttribute('id', 'yellow-summary-table-prompt')
            yellowPromptRow.textContent = 'Click on a process path name in any of the tables to add them here'
            yellowPromptRow.style.cssText += 'background-color: yellow'
            summaryTable.append(yellowPromptRow)

            const greenPromptRow = document.createElement("tr")
            greenPromptRow.setAttribute('id', 'green-summary-table-prompt')
            greenPromptRow.textContent = 'You can remove the process path from this table by clicking on its name again'
            greenPromptRow.style.cssText += 'background-color: #6ee7b7'
            summaryTable.append(greenPromptRow)

        } else if (document.getElementsByClassName("selected-summary").length == 3 && !document.getElementById("summary-table-category-row")) {
            if (document.getElementById("yellow-summary-table-prompt")) {
                document.getElementById("yellow-summary-table-prompt").remove()
                document.getElementById("green-summary-table-prompt").remove()
            }
            const categoriesRow = document.createElement('tr');
            categoriesRow.setAttribute("id", "summary-table-category-row")
            categoriesRow.style.cssText += `
                font-size: 1.2rem;
                color: white;
                background-color: #3b82f6;
                border-left: 1px solid black;
                border-right: 1px solid black;
            `

            const td1 = makeHeaderTd('Planned HCs');
            categoriesRow.appendChild(td1);
            const td2 = makeHeaderTd('Actual HCs');
            categoriesRow.appendChild(td2);
            const td3 = makeHeaderTd('HC Delta');
            categoriesRow.appendChild(td3);
            const td4 = makeHeaderTd('Planned Rate');
            categoriesRow.appendChild(td4);
            const td5 = makeHeaderTd('Actual Rate')
            categoriesRow.appendChild(td5)
            const td6 = makeHeaderTd('Rate Delta')
            categoriesRow.appendChild(td6)
            const td7 = makeHeaderTd('Planned Capacity')
            categoriesRow.appendChild(td7)
            const td8 = makeHeaderTd('Actual Capacity')
            categoriesRow.appendChild(td8)
            const td9 = makeHeaderTd('Capacity Delta')
            categoriesRow.appendChild(td9)
            summaryTable.appendChild(categoriesRow);
            addSummaryStats()
        } else {
            addSummaryStats()
    }

    function addSummaryStats() {
        const summaryTable = document.getElementById("summary-table")
        if (document.getElementById('summary-stats')) {
            document.getElementById('summary-stats').remove()
        }

        console.log(summaryPaths)

        const summaryRow = document.createElement('tr')
        summaryRow.setAttribute("id", "summary-stats")

        const plannedHcTd = makeTd(summaryPaths.plannedHcs.toFixed(1))
        summaryRow.appendChild(plannedHcTd)

        const actualHc = parseFloat(parseFloat(summaryPaths.actualHcs) / getTimeDiff().toFixed(1))
        const actualHcTd = makeTd(actualHc.toFixed(1))
        summaryRow.appendChild(actualHcTd)

        summaryRow.appendChild(makeDeltaTd(summaryPaths.plannedHcs, actualHc))

        const plannedCapacity = summaryPaths.plannedCapacity
        const plannedRate = ((parseFloat(plannedCapacity) / parseFloat(summaryPaths.plannedHcs)) / getTimeDiff()).toFixed(1)
        summaryRow.appendChild(makeTd(plannedRate))

        const actualCapacity = summaryPaths.actualCapacity
        const actualRate = ((parseFloat(summaryPaths.actualCapacity) / actualHc) / getTimeDiff()).toFixed(2)
        summaryRow.appendChild(makeTd(actualRate))

        summaryRow.appendChild(makeDeltaTd(plannedRate, actualRate))

        summaryRow.appendChild(makeTd(plannedCapacity.toFixed(1)))
        summaryRow.appendChild(makeTd(actualCapacity))
        summaryRow.appendChild(makeDeltaTd(summaryPaths.plannedCapacity, actualCapacity))


        summaryTable.appendChild(summaryRow)
    }
    }

    function makeCalculateButton() {
        const button = document.createElement('button');
        button.setAttribute('id', 'calculate-btn');
        button.textContent = 'Calculate';
        button.style.cssText += `font-size: 16px; width: 10rem; margin-top: 2rem; border: none; align-self: center;`;

        return button;
    }

    function makeResetButton() {
        const button = document.createElement('button');
        button.setAttribute('id', 'reset-btn');
        button.textContent = 'Reset';
        button.style.cssText += `font-size: 16px; width: 10rem; margin-top: 2rem; border: none; align-self: center;`;

        return button;
    }

    /*****************\
    |DOM element logic|
    \*****************/

    function openModal() {
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

    function closeModal() {
        const overlay = document.getElementById('overlay');
        overlay.style.display = 'none';

        // if on close the display div does not exist, make and attach it, otherwise update it
        if (!document.getElementById('time-display-div')) {
            loadTimeDisplayDiv();
        } else {
            // remove old one and reload new one
            const timeDisplayDiv = document.getElementById('time-display-div');
            timeDisplayDiv.remove();
            loadTimeDisplayDiv();
        }

        // must remove old settings div and reattach either way
        const settingsDiv = document.getElementById('schedule-settings-button');
        settingsDiv.remove();
        loadSettingsButton();
        if (!document.getElementById('table-div')) {
            loadTableData();
        }
    }   

    // save the inputs into local storage with the fc as the key
    function saveModalSettings(e) {
        const parent = e.target.parentElement.parentElement;
        const inputs = Array.from(parent.querySelectorAll('input'));
        const timeObject = {
            ds_start1: inputs[0].value,
            ds_end1: inputs[1].value,
            ds_start2: inputs[2].value,
            ds_end2: inputs[3].value,
            ds_start3: inputs[4].value,
            ds_end3: inputs[5].value,
            ds_start4: inputs[6].value,
            ds_end4: inputs[7].value,
            ds_start5: inputs[8].value,
            ds_end5: inputs[9].value,
            ns_start1: inputs[10].value,
            ns_end1: inputs[11].value,
            ns_start2: inputs[12].value,
            ns_end2: inputs[13].value,
            ns_start3: inputs[14].value,
            ns_end3: inputs[15].value,
            ns_start4: inputs[16].value,
            ns_end4: inputs[17].value,
            ns_start5: inputs[18].value,
            ns_end5: inputs[19].value  
        }

        // put the object into storage
        localStorage.setItem(`${fc}`, JSON.stringify(timeObject));
        closeModal();
    }

    function goToPick() {
        const urlFirstHalf = `https://fclm-portal.amazon.com/ppa/inspect/process?primaryAttribute=UNIT_FLOW_TYPE&secondaryAttribute=PICKING_PROCESS_PATH&nodeType=FC&warehouseId=${fc}&processId=100008`;
        window.location.assign(`${urlFirstHalf}${getDateUrlEnding()}`);
    }

    function goToPack() {
        const urlFirstHalf = `https://fclm-portal.amazon.com/ppa/inspect/process?primaryAttribute=UNIT_FLOW_TYPE&secondaryAttribute=PICKING_PROCESS_PATH&nodeType=FC&warehouseId=${fc}&processId=100054`;
        window.location.assign(`${urlFirstHalf}${getDateUrlEnding()}`);
    }

    function goToRebin() {
        const urlFirstHalf = `https://fclm-portal.amazon.com/ppa/inspect/process?primaryAttribute=WORK_FLOW&secondaryAttribute=PICKING_PROCESS_PATH&nodeType=FC&warehouseId=${fc}&processId=100053`;
        window.location.assign(`${urlFirstHalf}${getDateUrlEnding()}`);
    }

    // returns the ending date parameter portion for the submit url which is the same for each process
    function getDateUrlEnding() {
        const startDate = document.getElementById('startDateIntraday').value;
        const startDateYear = startDate.split('/')[0];
        const startDateMonth = startDate.split('/')[1];
        const startDateDay = startDate.split('/')[2];
        const startHourIntraday = document.getElementById('startHourIntraday').value;
        const startMinuteIntraday = document.getElementById('startMinuteIntraday').value;
        const endDate = document.getElementById('endDateIntraday').value;
        const endDateYear = endDate.split('/')[0];
        const endDateMonth = endDate.split('/')[1];
        const endDateDay = endDate.split('/')[2];
        const endHourIntraday = document.getElementById('endHourIntraday').value;
        const endMinuteIntraday = document.getElementById('endMinuteIntraday').value;

        return `&startDateDay=2019%2F12%2F20&startDateWeek=2019%2F12%2F20&startDateMonth=2022%2F08%2F01&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${startDateYear}%2F${startDateMonth}%2F${startDateDay}&startHourIntraday=${startHourIntraday}&startMinuteIntraday=${startMinuteIntraday}&endDateIntraday=${endDateYear}%2F${endDateMonth}%2F${endDateDay}&endHourIntraday=${endHourIntraday}&endMinuteIntraday=${endMinuteIntraday}`;
    }

    /***************************\
    |local storage functionality|
    \***************************/

    function getUserTimes() {
        return JSON.parse(localStorage.getItem(`${fc}`));
    }

    /****************\
    |table data logic|
    \****************/

    async function loadTableData() {
        // api should only load if the time period is > 1.25 hours and < 5 hours in order to reduce api calls
        startDate = document.getElementById('startDateIntraday').value.split("/")
        startHour = document.getElementById('startHourIntraday').value
        startMinute = document.getElementById('startMinuteIntraday').value
        startDateCombined = new Date(startDate[0], startDate[1] - 1, startDate[2], startHour, startMinute)
        endDate = document.getElementById('endDateIntraday').value.split("/")
        endHour = document.getElementById('endHourIntraday').value
        endMinute = document.getElementById('endMinuteIntraday').value
        endDateCombined = new Date(endDate[0], endDate[1] - 1, endDate[2], endHour, endMinute)
        differenceInMinutes = (endDateCombined - startDateCombined) / 1000 / 60
        if (differenceInMinutes > 300 || differenceInMinutes < 90) {
            return
        }

        loadStatusMessage('Finding plan data from dashboard');
        const planTime = await getPlanTime();
        document.getElementById('status-message').remove();
        const process = document.getElementById('select2-processSelector-container').textContent;
        if (process.includes('100008')) {
            loadPickTable(planTime);
        } else if (process.includes('100054')) {
            loadPackTable(planTime);
        } else if (process.includes('100053')) {
            loadRebinTable(planTime);
        }
    }

    async function loadPickTable(planTime) {
        // if undefined make a table that allows manual inputs for calculation
        if (!planTime) {
            const data = makeManualDataObject();
            console.log(data);
            const parent = document.getElementsByClassName('row')[0];

            const div = document.createElement('div');
            div.setAttribute('id', 'main-div');
            div.style.cssText += `display: flex; flex-direction: column; margin-top: 4rem`;

            const p = document.createElement('p');
            p.textContent = `No plan data found for time selected. If this is incorrect, please check the NSSP dashboard if a plan was sent within 50 minutes before the start of the time period, or 30 minutes after the start of the time period.`;
            p.style.cssText += `font-size: 16px; align-self: center; text-align: center;`;
            div.appendChild(p);

            const dashboardLink = document.createElement('a')
            dashboardLink.textContent = "NSSP Dashboard"
            dashboardLink.href = "https://ecft.fulfillment.a2z.com/#/NA/NSSP/PlanHistory"
            dashboardLink.style.cssText += `font-size: 1.5rem; font-weight: bold; text-align: center;`
            div.appendChild(dashboardLink)
            
            div.appendChild(makeManualTable(data));

            const calculateBtn = makeCalculateButton();
            calculateBtn.addEventListener('click', () => {
                // iterate over each process path and update object if there is data for that input
                for (const processPath in data) {
                    if (document.getElementById(`${processPath}-planned-hc-input`)) {
                        data[`${processPath}`]['planned_hc'] = parseFloat(document.getElementById(`${processPath}-planned-hc-input`).value);
                    }
                    if (document.getElementById(`${processPath}-planned-rate-input`)) {
                        data[`${processPath}`]['planned_rate'] = parseFloat(document.getElementById(`${processPath}-planned-rate-input`).value);
                    }
                    if (document.getElementById(`${processPath}-planned-hc-input`) && document.getElementById(`${processPath}-planned-rate-input`)) {
                        data[`${processPath}`]['planned_quantity'] = parseFloat(document.getElementById(`${processPath}-planned-hc-input`).value * document.getElementById(`${processPath}-planned-rate-input`).value * getTimeDiff());
                    }
                }
                document.getElementById('table-div').remove();
                document.getElementById('calculate-btn').remove();
                div.appendChild(makeManualTable(data));

                const resetBtn = makeResetButton();
                resetBtn.addEventListener('click', () => {
                    document.getElementById('main-div').remove();
                    loadPickTable(null);
                })

                div.appendChild(resetBtn);
            });

            div.appendChild(calculateBtn);

            parent.prepend(div);
        } else {
            const pickData = await makePickDataObject(planTime);
            console.log(pickData);
            const parent = document.getElementsByClassName('row')[0];

            const div = document.createElement('div');
            div.setAttribute('id', 'main-div');
            div.style.cssText += `display: flex; flex-direction: column; margin-top: 4rem`;

            const p = document.createElement('p');
            const date = planTime.split('T')[0];
            const time = planTime.split('T')[1].replace('Z', '').split('.')[0];
            p.textContent = `Data pulled from plan uploaded at ${time}, ${date}`;
            p.style.cssText += `font-size: 16px; align-self: center;`;
            div.appendChild(p);
            
            const tableDiv = document.createElement('div');
            div.setAttribute('id', 'table-div');
            tableDiv.style.cssText += `display: flex; gap: 5rem; margin-top: 16px;`
            const pickHcTable = makeHcTable(pickData);
            tableDiv.appendChild(pickHcTable);
            const pickRateTable = makeRateTable(pickData);
            tableDiv.appendChild(pickRateTable);
            const pickCapacityTable = makeCapacityTable(pickData);
            tableDiv.appendChild(pickCapacityTable);
            div.appendChild(tableDiv);

            const summaryTable = makeSummaryTable()
            div.appendChild(summaryTable)

            parent.prepend(div);
        }
    }

    async function loadPackTable(planTime) {
        // if undefined make a table that allows manual inputs for calculation
        if (!planTime) {
            const data = makeManualDataObject();
            console.log(data);
            const parent = document.getElementsByClassName('row')[0];

            const div = document.createElement('div');
            div.setAttribute('id', 'main-div');
            div.style.cssText += `display: flex; flex-direction: column; margin-top: 4rem`;

            const p = document.createElement('p');
            p.textContent = `No plan data found for time selected. If this is incorrect, please check the NSSP dashboard if a plan was sent within 50 minutes before the start of the time period, or 30 minutes after the start of the time period.`;
            p.style.cssText += `font-size: 16px; align-self: center; text-align: center;`;
            div.appendChild(p);

            const dashboardLink = document.createElement('a')
            dashboardLink.textContent = "Go to NSSP Dashboard"
            dashboardLink.href = "https://ecft.fulfillment.a2z.com/#/NA/NSSP/PlanHistory"
            dashboardLink.style.cssText += `font-size: 1.5rem; font-weight: bold; text-align: center;`
            div.appendChild(dashboardLink)
            
            div.appendChild(makeManualTable(data));

            const calculateBtn = makeCalculateButton();
            calculateBtn.addEventListener('click', () => {
                // iterate over each process path and update object if there is data for that input
                for (const processPath in data) {
                    if (document.getElementById(`${processPath}-planned-hc-input`)) {
                        data[`${processPath}`]['planned_hc'] = document.getElementById(`${processPath}-planned-hc-input`).value;
                    }
                    if (document.getElementById(`${processPath}-planned-rate-input`)) {
                        data[`${processPath}`]['planned_rate'] = document.getElementById(`${processPath}-planned-rate-input`).value;
                    }
                    if (document.getElementById(`${processPath}-planned-hc-input`) && document.getElementById(`${processPath}-planned-rate-input`)) {
                        data[`${processPath}`]['planned_quantity'] = document.getElementById(`${processPath}-planned-hc-input`).value * document.getElementById(`${processPath}-planned-rate-input`).value * getTimeDiff();
                    }
                }
                document.getElementById('table-div').remove();
                document.getElementById('calculate-btn').remove();
                div.appendChild(makeManualTable(data));

                const resetBtn = makeResetButton();
                resetBtn.addEventListener('click', () => {
                    document.getElementById('main-div').remove();
                    loadPickTable(null);
                })

                div.appendChild(resetBtn);
            });

            div.appendChild(calculateBtn);

            parent.prepend(div);
        } else {
            const packData = await makePackDataObject(planTime);
            console.log(packData);
            const parent = document.getElementsByClassName('row')[0];

            const div = document.createElement('div');
            div.setAttribute('id', 'main-div');
            div.style.cssText += `display: flex; flex-direction: column; margin-top: 4rem`;

            const p = document.createElement('p');
            const date = planTime.split('T')[0];
            const time = planTime.split('T')[1].replace('Z', '').split('.')[0];
            p.textContent = `Data pulled from plan uploaded at ${time}, ${date}`;
            p.style.cssText += `font-size: 16px; align-self: center;`;
            div.appendChild(p);
            
            const tableDiv = document.createElement('div');
            div.setAttribute('id', 'table-div');
            tableDiv.style.cssText += `display: flex; gap: 5rem; margin-top: 16px;`
            const packHcTable = makeHcTable(packData);
            tableDiv.appendChild(packHcTable);
            const packRateTable = makeRateTable(packData);
            tableDiv.appendChild(packRateTable);
            const packCapacityTable = makeCapacityTable(packData);
            tableDiv.appendChild(packCapacityTable);
            div.appendChild(tableDiv);

            const summaryTable = makeSummaryTable()
            div.appendChild(summaryTable)

            parent.prepend(div);
        }
    }

    async function loadRebinTable(planTime) {
        // if undefined make a table that allows manual inputs for calculation
        if (!planTime) {
            const rebinData = makeManualRebinDataObject();
            const parent = document.getElementsByClassName('row')[0];

            const div = document.createElement('div');
            div.setAttribute('id', 'main-div');
            div.style.cssText += `display: flex; flex-direction: column; margin-top: 4rem`;

            const p = document.createElement('p');
            p.textContent = `No plan data found for time selected. If this is incorrect, please check the NSSP dashboard if a plan was sent within 50 minutes before the start of the time period, or 30 minutes after the start of the time period.`;
            p.style.cssText += `font-size: 16px; align-self: center; text-align: center;`;
            div.appendChild(p);

            const dashboardLink = document.createElement('a')
            dashboardLink.textContent = "NSSP Dashboard"
            dashboardLink.href = "https://ecft.fulfillment.a2z.com/#/NA/NSSP/PlanHistory"
            dashboardLink.style.cssText += `font-size: 1.5rem; font-weight: bold; text-align: center;`
            div.appendChild(dashboardLink)
            
            div.appendChild(makeManualRebinTable(rebinData));

            const calculateBtn = makeCalculateButton();
            calculateBtn.addEventListener('click', () => {
                if (document.getElementById('planned-rate-input')) {
                    rebinData.planned_hc = document.getElementById('planned-hc-input').value;
                    rebinData.planned_rate = document.getElementById('planned-rate-input').value;
                }
                document.getElementById('table-div').remove();
                document.getElementById('calculate-btn').remove();
                div.appendChild(makeManualRebinTable(rebinData));

                const resetBtn = makeResetButton();
                resetBtn.addEventListener('click', () => {
                    document.getElementById('main-div').remove();
                    loadRebinTable(null);
                })

                div.appendChild(resetBtn);
            });

            div.appendChild(calculateBtn);

            parent.prepend(div);
        } else {
            const rebinData = await makeRebinDataObject(planTime);
            console.log(rebinData);
            const parent = document.getElementsByClassName('row')[0];

            const div = document.createElement('div');
            div.setAttribute('id', 'main-div');
            div.style.cssText += `display: flex; flex-direction: column; margin-top: 4rem`;

            const p = document.createElement('p');
            const date = planTime.split('T')[0];
            const time = planTime.split('T')[1].replace('Z', '').split('.')[0];
            p.textContent = `Data pulled from plan uploaded at ${time.split('.')[0]}, ${date}`;
            p.style.cssText += `font-size: 16px; align-self: center;`;
            div.appendChild(p);
            
            div.appendChild(makeRebinTable(rebinData));

            const calculateBtn = makeCalculateButton();
            div.appendChild(calculateBtn);
            calculateBtn.addEventListener('click', () => {
                if (document.getElementById('planned-rate-input')) {
                    rebinData.planned_rate = document.getElementById('planned-rate-input').value;
                }
                document.getElementById('table-div').remove();
                document.getElementById('calculate-btn').remove();
                div.appendChild(makeRebinTable(rebinData));

                const resetBtn = makeResetButton();
                resetBtn.addEventListener('click', () => {
                    document.getElementById('main-div').remove();
                    loadRebinTable(planTime);
                })

                div.appendChild(resetBtn);
            });

            parent.prepend(div);
        }
    }

    function makeRebinTable(rebinData) {
        const tableDiv = document.createElement('div');
        tableDiv.setAttribute('id', 'table-div');
        tableDiv.style.cssText += `display: flex; align-self: center; gap: 5rem; margin-top: 16px;`;
        const rebinHcTable = makeRebinHcTable(rebinData);
        tableDiv.appendChild(rebinHcTable);
        const rebinRateTable = makeRebinRateTable(rebinData);
        tableDiv.appendChild(rebinRateTable);
        const rebinCapacityTable = makeRebinCapacityTable(rebinData);
        tableDiv.appendChild(rebinCapacityTable);

        return tableDiv;
    }

    function loadStatusMessage(message) {
        if (document.getElementById("status-message")) {
            document.getElementById("status-message").remove()
        }
        const div = document.createElement('div');
        div.style.cssText += `display: flex; justify-content: center; margin-top: 4rem; text-align: center;`;
        const parent = document.getElementsByClassName('row')[0];        
        const statusMessage = document.createElement('p');
        statusMessage.setAttribute('id', 'status-message');
        statusMessage.style.cssText += `font-size: 16px; align-self: center; width: 50%;`;
        statusMessage.textContent = message;
        div.appendChild(statusMessage);

        parent.prepend(div);
    }

    /***************\
    |ppa table logic|
    \***************/

    function makeHcTable(data) {
        const hcTable = document.createElement('table');
        hcTable.style.cssText += `text-align: center; border-collapse: collapse;`

        const titleRow = document.createElement('tr');
        titleRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border: 1px solid black;
            border-bottom: none;
        `

        const titleHeader = document.createElement('td');
        titleHeader.textContent = 'Headcounts';
        titleHeader.style.cssText += `text-align: center; font-size: 1.6rem; font-weight: bold;`;
        titleHeader.colSpan = '4';
        titleRow.appendChild(titleHeader);
        hcTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border-left: 1px solid black;
            border-right: 1px solid black;
        `

        const td1 = makeHeaderTd('Process Path');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('Planned');
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Actual');
        categoriesRow.appendChild(td3);
        const td4 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td4);
        hcTable.appendChild(categoriesRow);

        for (const processPath in data) {
            if (data[`${processPath}`].planned_hc) {
                hcTable.appendChild(makeHcRow(processPath, data[`${processPath}`])); // only make table if there was a planned hc otherwise skip
            } 
        }
        hcTable.appendChild(makeTotalRow(plannedTotal, actualTotal, deltaTotal));

        return hcTable;
    }

    function makeRateTable(data) {
        const rateTable = document.createElement('table');

        const titleRow = document.createElement('tr');
        titleRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border: 1px solid black;
            border-bottom: none;
        `

        const titleHeader = document.createElement('td');
        titleHeader.textContent = 'Rates';
        titleHeader.style.cssText += `text-align: center; font-size: 1.6rem; font-weight: bold;`;
        titleHeader.colSpan = '4';
        titleRow.appendChild(titleHeader);
        rateTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border-left: 1px solid black;
            border-right: 1px solid black;
        `

        const td1 = makeHeaderTd('Process Path');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('Planned');
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Actual');
        categoriesRow.appendChild(td3);
        const td4 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td4);
        rateTable.appendChild(categoriesRow);

        for (const processPath in data) {
            if (data[`${processPath}`].planned_hc) {
                rateTable.appendChild(makeRateRow(processPath, data[`${processPath}`])); // only make table if there was a planned hc otherwise skip
            } 
        }

        // blank row to align with paths of other tables
        const blankRow = document.createElement('tr');
        blankRow.style.cssText += `color: white; font-size: 16px; border-top: 3px solid black;`;
        const blankTd = document.createElement('td');
        blankTd.textContent = 'blank on purpose';
        blankTd.style.cssText += `padding: 2px 0.5rem 2px 0.3rem;`;
        blankRow.appendChild(blankTd);
        rateTable.appendChild(blankRow);

        return rateTable;
    }

    function makeCapacityTable(data) {
        const capacityTable = document.createElement('table');

        const titleRow = document.createElement('tr');
        titleRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border: 1px solid black;
            border-bottom: none;
        `

        const titleHeader = document.createElement('td');
        titleHeader.textContent = 'Capacities';
        titleHeader.style.cssText += `text-align: center; font-size: 1.6rem; font-weight: bold;`;
        titleHeader.colSpan = '4';
        titleRow.appendChild(titleHeader);
        capacityTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border-left: 1px solid black;
            border-right: 1px solid black;
        `

        const td1 = makeHeaderTd('Process Path');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('Planned');
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Actual');
        categoriesRow.appendChild(td3);
        const td4 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td4);
        capacityTable.appendChild(categoriesRow);

        for (const processPath in data) {
            if (data[`${processPath}`].planned_hc) {
                capacityTable.appendChild(makeCapacityRow(processPath, data[`${processPath}`])); // only make table if there was a planned hc otherwise skip
            } 
        }
        capacityTable.appendChild(makeTotalRow(plannedCapacityTotal, actualCapacityTotal, capacityDeltaTotal));

        return capacityTable;
    }

    function makeRebinHcTable(data) {
        const hcTable = document.createElement('table');
        hcTable.style.cssText += `text-align: center; border-collapse: collapse;`

        const titleRow = document.createElement('tr');
        titleRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border: 1px solid black;
            border-bottom: none;
        `

        const titleHeader = document.createElement('td');
        titleHeader.textContent = 'Headcounts';
        titleHeader.style.cssText += `text-align: center; font-size: 1.6rem; font-weight: bold;`;
        titleHeader.colSpan = '3';
        titleRow.appendChild(titleHeader);
        hcTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border-left: 1px solid black;
            border-right: 1px solid black;
        `

        const td1 = makeHeaderTd('Planned');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('Actual');
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td3);
        hcTable.appendChild(categoriesRow);

        hcTable.appendChild(makeRebinHcRow(data)); 

        return hcTable;
    }

    function makeRebinRateTable(data) {
        const rateTable = document.createElement('table');
        rateTable.style.cssText += `text-align: center; border-collapse: collapse;`

        const titleRow = document.createElement('tr');
        titleRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border: 1px solid black;
            border-bottom: none;
        `

        const titleHeader = document.createElement('td');
        titleHeader.textContent = 'Rates';
        titleHeader.style.cssText += `text-align: center; font-size: 1.6rem; font-weight: bold;`;
        titleHeader.colSpan = '3';
        titleRow.appendChild(titleHeader);
        rateTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border-left: 1px solid black;
            border-right: 1px solid black;
        `

        const td1 = makeHeaderTd('Planned');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('Actual');
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td3);
        rateTable.appendChild(categoriesRow);

        rateTable.appendChild(makeRebinRateRow(data)); 

        return rateTable;
    }

    function makeRebinCapacityTable(data) {
        const capacityTable = document.createElement('table');
        capacityTable.style.cssText += `text-align: center; border-collapse: collapse;`

        const titleRow = document.createElement('tr');
        titleRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border: 1px solid black;
            border-bottom: none;
        `

        const titleHeader = document.createElement('td');
        titleHeader.textContent = 'Capacity';
        titleHeader.style.cssText += `text-align: center; font-size: 1.6rem; font-weight: bold;`;
        titleHeader.colSpan = '3';
        titleRow.appendChild(titleHeader);
        capacityTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border-left: 1px solid black;
            border-right: 1px solid black;
        `

        const td1 = makeHeaderTd('Planned');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('Actual');
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td3);
        capacityTable.appendChild(categoriesRow);

        capacityTable.appendChild(makeRebinCapacityRow(data)); 

        return capacityTable;
    }

    function makeManualTable(data) {
        const tableDiv = document.createElement('div');
        tableDiv.setAttribute('id', 'table-div');
        tableDiv.style.cssText += `display: flex; align-self: center; gap: 5rem; margin-top: 16px;`;
        const hcTable = makeManualHcTable(data);
        tableDiv.appendChild(hcTable);
        const rateTable = makeManualRateTable(data);
        tableDiv.appendChild(rateTable);
        const capacityTable = makeManualCapacityTable(data);
        tableDiv.appendChild(capacityTable);

        return tableDiv;
    }

    function makeManualHcTable(data) {
        const hcTable = document.createElement('table');
        hcTable.style.cssText += `text-align: center; border-collapse: collapse;`

        const titleRow = document.createElement('tr');
        titleRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border: 1px solid black;
            border-bottom: none;
        `

        const titleHeader = document.createElement('td');
        titleHeader.textContent = 'Headcounts';
        titleHeader.style.cssText += `text-align: center; font-size: 1.6rem; font-weight: bold;`;
        titleHeader.colSpan = '4';
        titleRow.appendChild(titleHeader);
        hcTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border-left: 1px solid black;
            border-right: 1px solid black;
        `
        const td1 = makeHeaderTd('Process Path');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('Planned');
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Actual');
        categoriesRow.appendChild(td3);
        const td4 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td4);
        hcTable.appendChild(categoriesRow);

        for (const processPath in data) {
            hcTable.appendChild(makeManualHcRow(processPath, data[`${processPath}`])); 
        }

        return hcTable;
    }

    function makeManualRateTable(data) {
        const rateTable = document.createElement('table');
        rateTable.style.cssText += `text-align: center; border-collapse: collapse;`

        const titleRow = document.createElement('tr');
        titleRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border: 1px solid black;
            border-bottom: none;
        `

        const titleHeader = document.createElement('td');
        titleHeader.textContent = 'Rates';
        titleHeader.style.cssText += `text-align: center; font-size: 1.6rem; font-weight: bold;`;
        titleHeader.colSpan = '4';
        titleRow.appendChild(titleHeader);
        rateTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border-left: 1px solid black;
            border-right: 1px solid black;
        `
        const td1 = makeHeaderTd('Process Path');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('Planned');
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Actual');
        categoriesRow.appendChild(td3);
        const td4 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td4);
        rateTable.appendChild(categoriesRow);

        for (const processPath in data) {
            rateTable.appendChild(makeManualRateRow(processPath, data[`${processPath}`])); 
        }

        return rateTable;
    }

    function makeManualCapacityTable(data) {
        const capacityTable = document.createElement('table');
        capacityTable.style.cssText += `text-align: center; border-collapse: collapse;`

        const titleRow = document.createElement('tr');
        titleRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border: 1px solid black;
            border-bottom: none;
        `

        const titleHeader = document.createElement('td');
        titleHeader.textContent = 'Capacity';
        titleHeader.style.cssText += `text-align: center; font-size: 1.6rem; font-weight: bold;`;
        titleHeader.colSpan = '4';
        titleRow.appendChild(titleHeader);
        capacityTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border-left: 1px solid black;
            border-right: 1px solid black;
        `
        const td1 = makeHeaderTd('Process Path');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('Planned');
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Actual');
        categoriesRow.appendChild(td3);
        const td4 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td4);
        capacityTable.appendChild(categoriesRow);

        for (const processPath in data) {
            capacityTable.appendChild(makeManualCapacityRow(processPath, data[`${processPath}`])); 
        }

        return capacityTable;
    }

    function makeManualRebinTable(data) {
        const tableDiv = document.createElement('div');
        tableDiv.setAttribute('id', 'table-div');
        tableDiv.style.cssText += `display: flex; align-self: center; gap: 5rem; margin-top: 16px;`;
        const rebinHcTable = makeManualRebinHcTable(data);
        tableDiv.appendChild(rebinHcTable);
        const rebinRateTable = makeManualRebinRateTable(data);
        tableDiv.appendChild(rebinRateTable);
        const rebinCapacityTable = makeManualRebinCapacityTable(data);
        tableDiv.appendChild(rebinCapacityTable);

        return tableDiv;
    }

    function makeManualRebinHcTable(data) {
        const hcTable = document.createElement('table');
        hcTable.style.cssText += `text-align: center; border-collapse: collapse;`

        const titleRow = document.createElement('tr');
        titleRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border: 1px solid black;
            border-bottom: none;
        `

        const titleHeader = document.createElement('td');
        titleHeader.textContent = 'Headcounts';
        titleHeader.style.cssText += `text-align: center; font-size: 1.6rem; font-weight: bold;`;
        titleHeader.colSpan = '3';
        titleRow.appendChild(titleHeader);
        hcTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border-left: 1px solid black;
            border-right: 1px solid black;
        `

        const td1 = makeHeaderTd('Planned');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('Actual');
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td3);
        hcTable.appendChild(categoriesRow);

        hcTable.appendChild(makeManualRebinHcRow(data)); 

        return hcTable;
    }

    function makeManualRebinRateTable(data) {
        const rateTable = document.createElement('table');
        rateTable.style.cssText += `text-align: center; border-collapse: collapse;`

        const titleRow = document.createElement('tr');
        titleRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border: 1px solid black;
            border-bottom: none;
        `

        const titleHeader = document.createElement('td');
        titleHeader.textContent = 'Rates';
        titleHeader.style.cssText += `text-align: center; font-size: 1.6rem; font-weight: bold;`;
        titleHeader.colSpan = '3';
        titleRow.appendChild(titleHeader);
        rateTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border-left: 1px solid black;
            border-right: 1px solid black;
        `

        const td1 = makeHeaderTd('Planned');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('Actual');
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td3);
        rateTable.appendChild(categoriesRow);

        rateTable.appendChild(makeRebinRateRow(data)); 

        return rateTable;
    }

    function makeManualRebinCapacityTable(data) {
        const capacityTable = document.createElement('table');
        capacityTable.style.cssText += `text-align: center; border-collapse: collapse;`

        const titleRow = document.createElement('tr');
        titleRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border: 1px solid black;
            border-bottom: none;
        `

        const titleHeader = document.createElement('td');
        titleHeader.textContent = 'Capacity';
        titleHeader.style.cssText += `text-align: center; font-size: 1.6rem; font-weight: bold;`;
        titleHeader.colSpan = '3';
        titleRow.appendChild(titleHeader);
        capacityTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border-left: 1px solid black;
            border-right: 1px solid black;
        `

        const td1 = makeHeaderTd('Planned');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('Actual');
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td3);
        capacityTable.appendChild(categoriesRow);

        capacityTable.appendChild(makeRebinCapacityRow(data)); 

        return capacityTable;
    }

    function makeSummaryTable() {
        const summaryTable = document.createElement('table')
        summaryTable.setAttribute('id', 'summary-table')
        summaryTable.style.cssText += `align-self: center; margin-top: 3rem; border: 1px solid black;
        text-align: center; border-collapse: collapse;`

        const titleRow = document.createElement('tr');
        titleRow.style.cssText += `
            font-size: 1.2rem;
            color: white;
            background-color: #3b82f6;
            border: 1px solid black;
            border-bottom: none;
        `

        const titleHeader = document.createElement('td');
        titleHeader.textContent = 'Summary';
        titleHeader.style.cssText += `text-align: center; font-size: 1.6rem; font-weight: bold;`;
        titleHeader.colSpan = '9';
        titleRow.appendChild(titleHeader);
        summaryTable.appendChild(titleRow);

        const yellowPromptRow = document.createElement("tr")
        yellowPromptRow.setAttribute('id', 'yellow-summary-table-prompt')
        yellowPromptRow.textContent = 'Click on a process path name in any of the tables to add them here'
        yellowPromptRow.style.cssText += 'background-color: yellow'
        summaryTable.append(yellowPromptRow)

        const greenPromptRow = document.createElement("tr")
        greenPromptRow.setAttribute('id', 'green-summary-table-prompt')
        greenPromptRow.textContent = 'You can remove the process path from this table by clicking on its name again'
        greenPromptRow.style.cssText += 'background-color: #6ee7b7'
        summaryTable.append(greenPromptRow)

        return summaryTable
    }
    
    /**************\
    |plan API logic|
    \**************/

    // return the time of the plan most relevant to time period selected which will be the plan with time closest to start time of that quarter/period
    async function getPlanTime() {
        const allPlans = await getPlanTimes();
        const allPlansData = JSON.parse(allPlans);
        const planTimes = getFcPlanTimes(allPlansData);

        const startDateString = document.getElementById('startDateIntraday').value;
        const startHour = document.getElementById('startHourIntraday').value;
        const startMinute = document.getElementById('startMinuteIntraday').value;
        const startDate = new Date(startDateString.split('/')[0], startDateString.split('/')[1] - 1, startDateString.split('/')[2], startHour, startMinute);

        // first look for the closest plan at most 50 minutes before start time
        let closestPlan;
        for (const planTime of planTimes) {
            let closestPlanTime = -51;
            const date = planTime.split('T')[0];
            const year = date.split('-')[0];
            const month = date.split('-')[1] - 1;
            const day = date.split('-')[2];
            const time = planTime.split('T')[1];
            const hour = time.split(':')[0];
            const minute = time.split(':')[1];
            const planDate = new Date(year, month, day, hour, minute);
            console.log(`difference for ${planTime}: ${(planDate - startDate) / 60000}`)
            const difference = (planDate - startDate) / 60000;
            if (difference > closestPlanTime && difference < 0) {
                closestPlanTime = difference;
                closestPlan = planTime;
            }
        }

        // if there was no plan within 50 mins before start time, use closest plan within 30 mins after start time
        if (!closestPlan) {
            for (const planTime of planTimes) {
                let closestPlanTime = 31;
                const date = planTime.split('T')[0];
                const year = date.split('-')[0];
                const month = date.split('-')[1] - 1;
                const day = date.split('-')[2];
                const time = planTime.split('T')[1];
                const hour = time.split(':')[0];
                const minute = time.split(':')[1];
                const planDate = new Date(year, month, day, hour, minute);
                console.log(`difference for ${planTime}: ${(planDate - startDate) / 60000}`)
                const difference = (planDate - startDate) / 60000;
                if (difference < closestPlanTime && difference > 0) {
                    closestPlanTime = difference;
                    closestPlan = planTime;
                }
            }
        }

        console.log(`closest plan is ${closestPlan}`);

        return closestPlan;
    }


    // calls the big table data and filters for the plan times of the specific fc
    function getPlanTimes() {
        console.log(getBigTableLink())
        return new Promise(function(resolve) {
            GM.xmlHttpRequest({
                method: 'GET',
                url: getBigTableLink(),
                onreadystatechange: function(response) {
                    console.log(`big table response: ${response.readyState}`)
                    console.log(`big table status: ${response.status}`)
                    if (response.readyState == 4 && response.status == 200) {
                        console.log(this.response)
                        resolve(this.response);
                    } else if (response.status == 500) {
                        loadStatusMessage("HTML Error 500: Internal Server Error. Unable to connect to dashboard at this time. Please try again later.")
                    } else if (response.status >= 500 && response.status !== 500) {
                        loadStatusMessage('Failed to connect to dashboard. Please try again.');
                    } else if (response.status == 401 || response.status == 403) {
                        loadStatusMessage('Failed to connect to dashboard. Please ensure you are authenticated in midway.');
                    }  
                }
            })
        }).then((data) => {
            console.log(`data: ${data}`)
            return data
        });
    }

    // return an array of plan times for the specific fc
    function getFcPlanTimes(allPlansData) {
        const planTimes = [];
        for (const plan of allPlansData) {
            if (plan.fc === fc) {
                planTimes.push(plan.sent_timestamp_latest);
            }
        }

        return planTimes;
    }

    // returns the link to call the big table api, which uses 3 hours ago from the query start time
    function getBigTableLink() {
        const startDate = document.getElementById('startDateIntraday').value.split("/")
        const startHour = document.getElementById('startHourIntraday').value
        let date = new Date(startDate[0], startDate[1], startDate[2], startHour - 3)
        hour = date.getHours() < 10 ? `0${date.getHours()}` : date.getHours()
        day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate()
        month = date.getMonth() < 10 ? `0${date.getMonth()}` : date.getMonth()
        return `https://ecft.fulfillment.a2z.com/api/NA/nssp/get_nssp_big_table_new?startDate=${date.getFullYear()}-${month}-${day}&startTime=${hour}:00:00&fcSelected=ABE4,ACY2,AKR1,ALB1,AMA1,CHA2,CHO1,CMH2,CMH3,DEN8,DET2,FAT2,FOE1,FTW5,GEG2,GSO1,HOU8,HSV1,ICT2,IGQ2,ILG1,IND2,JAX3,JVL1,LAS6,LFT1,LGB6,LIT2,MCE1,MCO2,MDT4,MDW6,MDW9,MGE3,MKC4,OKC2,ORD2,PDX7,PHL6,PHX5,PHX7,SAT4,SCK1,SJC7,SLC2,SMF6,STL3,STL4,SWF1,TEB3,TEB4,TPA3,YEG1,YOO1,YOW1,YYZ9&region=NA`
    }

    function getPickData(planTime) {
        return new Promise(function(resolve) {
            GM.xmlHttpRequest({
                method: 'GET',
                url: `https://ecft.fulfillment.a2z.com/api/NA/nssp/get_nssp_pp_extended?fc=${fc}&senttimestamp=${planTime}&region=NA`,
                onreadystatechange: function(response) {
                    if (response.readyState == 4 && response.status == 200) {
                        resolve(this.response);
                    } 
                }
            })
        }).then((data) => {
            return data
        });
    }

    // returns an object with all planned pick data from API and all actual pick data from PPA pick table
    async function makePickDataObject(planTime) {
        const pickData = await getPickData(planTime);
        const parsedPickData = JSON.parse(pickData);
        const allPickData = {};
        for (let i = 0; i < parsedPickData.length; i++) {
            const processPath = parsedPickData[i].pp_name;
            const actualsData = getProcessPathInfo(processPath);
            allPickData[`${processPath}`] = {};

            allPickData[`${processPath}`]['planned_hc'] = parseFloat(parsedPickData[i].planned_hc_hr);
            allPickData[`${processPath}`]['actual_hc'] = parseFloat(actualsData ? actualsData[5].textContent.replaceAll(",", "") : 0);

            allPickData[`${processPath}`]['planned_rate'] = parseFloat(parsedPickData[i].rate_pick.toFixed(1));
            allPickData[`${processPath}`]['actual_rate'] = parseFloat(actualsData ? actualsData[7].textContent.replaceAll(",", "") : 0);

            allPickData[`${processPath}`]['planned_quantity_hr'] = parseFloat(Math.round(parsedPickData[i].planned_hc_hr * parsedPickData[i].rate_pick));
            allPickData[`${processPath}`]['actual_quantity'] = parseInt(actualsData ? actualsData[2].textContent.replaceAll(",", "") : 0);
        }

        return allPickData;
    }

    // gets info from the pick api which has pack data per process path
    async function makePackDataObject(planTime) {
        const packData = await getPickData(planTime);
        const parsedPackData = JSON.parse(packData);
        console.log(parsedPackData);
        const allPackData = {};
        for (let i = 0; i < parsedPackData.length; i++) {
            const processPath = parsedPackData[i].pp_name;
            const actualsData = getProcessPathInfo(processPath);
            allPackData[`${processPath}`] = {};

            allPackData[`${processPath}`]['planned_hc'] = parseFloat(parsedPackData[i].hc_pack.toFixed(1));
            allPackData[`${processPath}`]['actual_hc'] = parseFloat(actualsData ? actualsData[5].textContent.replaceAll(",", "") : 0);

            allPackData[`${processPath}`]['planned_rate'] = parseFloat(parsedPackData[i].rate_pack.toFixed(1));
            allPackData[`${processPath}`]['actual_rate'] = parseFloat(actualsData ? actualsData[7].textContent.replaceAll(",", "") : 0);

            allPackData[`${processPath}`]['planned_quantity_hr'] = parseFloat(Math.round(parsedPackData[i].hc_pack * parsedPackData[i].rate_pack));
            allPackData[`${processPath}`]['actual_quantity'] = parseInt(actualsData ? actualsData[2].textContent.replaceAll(",", "") : 0);
        }

        return allPackData;
    }

    // only rebin data in api is hc
    async function makeRebinDataObject(planTime) {
        const pickData = await getPickData(planTime);
        const parsedRebinData = JSON.parse(pickData);
        const allRebinData = {};
        allRebinData['planned_hc'] = 0;
        for (let i = 0; i < parsedRebinData.length; i++) {
            const processPath = parsedRebinData[i].pp_name;
            if (processPath.includes('Multi')) {
                allRebinData['planned_hc'] += parsedRebinData[i].hc_rebin;
            }
            const actualsData = getRebinTotals();
            allRebinData['actual_hc'] = actualsData ? actualsData[5].textContent : 0;
            allRebinData['actual_rate'] = actualsData ? actualsData[7].textContent : 0;
            allRebinData['actual_quantity'] = actualsData ? actualsData[2].textContent : 0;
        }

        return allRebinData;
    }

    // returns the row of the appropriate process path. if not found in table, return null
    function getProcessPathInfo(processPath) {
        const ppRows = Array.from(document.querySelectorAll('tbody')[1].querySelectorAll('tr'));
        for (const row of ppRows) {
            if (row.querySelectorAll('td')[0].textContent.toLowerCase() === processPath.toLowerCase()) {
                return Array.from(row.querySelectorAll('td'));
            } 
        }

        return null;
    }

    function getRebinTotals() {
        return Array.from(document.querySelectorAll('tfoot')[0].querySelector('tr').querySelectorAll('td'));
    }

    // return time period in hours
    function getTimeDiff() {
        const endHour = document.getElementById('endHourIntraday').value;
        const startHour = document.getElementById('startHourIntraday').value;
        const endMinute = fractionalizeMinute(document.getElementById('endMinuteIntraday').value);
        const startMinute = fractionalizeMinute(document.getElementById('startMinuteIntraday').value);
        
        if (parseInt(endHour) > parseInt(startHour)) { // for times not crossing over midnight
            const end = parseFloat(endHour) + parseFloat(endMinute);
            const start = parseFloat(startHour) + parseFloat(startMinute);

            return end - start;
        } else {
            const end = parseFloat(endHour) + parseFloat(endMinute);
            const start = parseFloat(startHour) + parseFloat(startMinute);
            return Math.abs(end - start + 24);
        }
    }

    function fractionalizeMinute(minute) {
        switch (minute) {
            case '15': return .25;
            case '30': return .5;
            case '45': return .75;
            default: return 0;
        }
    }

    /******************\
    |manual data objects|
    \*******************/

    function makeManualDataObject() {
        const dataObject = {};

        // make attribute for each process path by iterating through the ppa table
        const rows = Array.from(document.querySelectorAll('tbody')[1].querySelectorAll('tr'));
        for (let i = 0; i < rows.length; i++) {
            const tds = Array.from(rows[i].querySelectorAll('td'));
            const processPath = tds[0].textContent;
            // skip over ppqa and hotpick
            if (processPath.includes('PPQA') || processPath.includes('HOTPICK')) {
                continue;
            }
            dataObject[`${processPath}`] = {};
            dataObject[`${processPath}`]['planned_hc'] = null;
            dataObject[`${processPath}`]['planned_rate'] = null;
            dataObject[`${processPath}`]['planned_quantity'] = null;
            dataObject[`${processPath}`]['actual_hc'] = tds[5].textContent;
            dataObject[`${processPath}`]['actual_rate'] = tds[7].textContent;
            dataObject[`${processPath}`]['actual_quantity'] = tds[2].textContent;
        }

        return dataObject;
    }

    function makeManualRebinDataObject() {
        const rebinDataObject = {};
        const actualsData = getRebinTotals();
        rebinDataObject['planned_hc'] = null;
        rebinDataObject['planned_rate'] = null;
        rebinDataObject['planned_quantity'] = null;
        rebinDataObject['actual_hc'] = actualsData ? actualsData[5].textContent : 0;
        rebinDataObject['actual_rate'] = actualsData ? actualsData[7].textContent : 0;
        rebinDataObject['actual_quantity'] = actualsData ? actualsData[2].textContent : 0;

        return rebinDataObject;
    }

}


