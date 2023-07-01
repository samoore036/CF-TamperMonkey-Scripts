// ==UserScript==
// @name         ppa calc
// @updateURL    https://github.com/samoore036/CF-TamperMonkey-Scripts/tree/main/cpt%20puller
// @downloadURL  https://github.com/samoore036/CF-TamperMonkey-Scripts/tree/main/cpt%20puller
// @namespace    https://github.com/samoore036/CF-TamperMonkey-Scripts
// @version      0.5.1
// @description  Pull planned hcs/rates and compare against ppa
// @author       mooshahe
// @match        https://fclm-portal.amazon.com/ppa/inspect/*
// @grant        GM.xmlHttpRequest
// @connect      ecft.fulfillment.a2z.com
// ==/UserScript==




(() => {
    /****************\
    |global variables|
    \****************/
    const fc = document.getElementById('fcpn-site-input').value;
    const planTimes = [];
    let plannedTotal = 0;
    let actualTotal = 0;
    let deltaTotal = 0;
    let plannedCapacityTotal = 0;
    let actualCapacityTotal = 0;
    let capacityDeltaTotal = 0;

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
            // only load table data if it is not full shift. must account for dayshift and nightshift time differences between quarters/periods as nights crosses over a day
            // first check if it's day shift. if so, difference between start and end hour should be less than 9
        } else if (document.getElementById('startDateIntraday').value === document.getElementById('endDateIntraday').value) {
            if (Math.abs(document.getElementById('startHourIntraday').value - document.getElementById('endHourIntraday').value < 9)) {
                loadTableData();
            }
        } else { //accounts for night shift if the start date and end date are different. in this case shift length should be greater than 15
            if (document.getElementById('startHourIntraday').value - document.getElementById('endHourIntraday').value > 15) {
                loadTableData();
            }
        }
    }

    /****************\
    |DOM manipulation|
    \****************/

    function setupDom() {
        document.body.appendChild(makeModal());
    }

    function makeModal() {
        const modal = document.createElement('div');
        modal.setAttribute('id', 'modal');
        // modal.style.display = 'none';
        modal.appendChild(makeCloseSettingsBtn());
        
        const prompt = document.createElement('p');
        prompt.textContent = `Please enter period/quarter start/end times`;
        prompt.style.cssText+= 'font-size: 1.7rem; text-align: center;';
        modal.appendChild(prompt);

        const timeDiv = document.createElement('div');
        timeDiv.setAttribute('id', 'modal-input-div');
        timeDiv.style.cssText += `display: flex; flex-direction: column; gap: 2rem;`
        for (let i = 1; i < 6; i++) {
            timeDiv.appendChild(makeTimeInputDiv(i));
        }
        modal.appendChild(timeDiv);
    
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.style.cssText += `
            align-self: center; width: 15rem; margin-top: 1rem;
            color: black; background-color: white; font-size: 1.5rem;
        `
        saveButton.addEventListener('click', saveModalSettings);
        timeDiv.appendChild(saveButton);

        return modal;
    }

    function makeCloseSettingsBtn() {
        const button = document.createElement('button');
        button.setAttribute('id', 'close-btn');
        button.style.cssText += `
            position: relative; bottom: 3rem; left: 38.7rem;
            border: medium none;
            font-size: 1.7rem; width: 2.5rem; height: 2.5rem;
            color: white; background-color: rgb(220, 38, 38);
            cursor: pointer;
        `
        button.textContent = '✖';
        button.addEventListener('click', closeModal);

        return button;
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

        const timeButtonTray = document.createElement('div');
        timeButtonTray.style.cssText += `display: flex; gap: 0.1rem;`;
        const fullShiftButton = makeTimeButton('Full Shift');
        fullShiftButton.addEventListener('click', () => {
            let endTime;
            // must iterate backwards to find endtime
            for (let i = 5; i > 0; i--) {
                if (getUserTimes()[`end${i}`]) {
                    endTime = getUserTimes()[`end${i}`];
                    break;
                }
            }
            const startHour = getUserTimes()[`start${1}`].split(':')[0];
            const startMinute = getUserTimes()[`start${1}`].split(':')[1];
            const endHour = endTime.split(':')[0];
            const endMinute = endTime.split(':')[1];
            document.getElementById('startHourIntraday').selectedIndex = startHour;
            document.getElementById('startMinuteIntraday').selectedIndex = getSelectIndexMinute(startMinute);
            document.getElementById('endHourIntraday').selectedIndex = endHour;
            document.getElementById('endMinuteIntraday').selectedIndex = getSelectIndexMinute(endMinute);
        })

        timeButtonTray.appendChild(fullShiftButton);
        loadTimeButtons(timeButtonTray);

        div.appendChild(dateButtonTray);
        div.appendChild(timeButtonTray);

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
    
    function makeTimeInputDiv(number) {
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
        startDiv.appendChild(startInput);
        div.appendChild(startDiv);
        if (getUserTimes()) {
            if (getUserTimes()[`start${number}`]) {
                startInput.value = getUserTimes()[`start${number}`];
            }
        }

        const endDiv = document.createElement('div');
        const endPrompt = document.createElement('div');
        endPrompt.textContent = 'End time:';
        endDiv.appendChild(endPrompt);
        const endInput = document.createElement('input');
        endInput.style.color = 'black';
        endInput.placeholder = 'ex: 09:45';
        endDiv.appendChild(endInput);
        div.appendChild(endDiv);
        if (getUserTimes()) {
            if (getUserTimes()[`end${number}`]) {
                endInput.value = getUserTimes()[`end${number}`];
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

    function makeTimeButton(name, i) {
        const button = document.createElement('button');
        button.textContent = name;
        button.style.cssText += `
            border: 2px solid #2e6da4; background-color: #337ab7; color: white;
            padding: 6px 12px; 
        `
        button.type = 'button';

        if (i) {
            button.addEventListener('click', () => {
                const startHour = getUserTimes()[`start${i}`].split(':')[0];
                const startMinute = getUserTimes()[`start${i}`].split(':')[1];
                const endHour = getUserTimes()[`end${i}`].split(':')[0];
                const endMinute = getUserTimes()[`end${i}`].split(':')[1];
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

    function loadTimeButtons(timeButtonTray) {
        // first determine if periods or quarters by checking fourth time. if this is null, it's periods, otherwise quarters
        let isPeriods = true;
        const userTimes = getUserTimes();
        if (userTimes.start4 && userTimes.end4) {
            isPeriods = false;
        }

        for (let i = 1; i < 6; i++) {
            const title = isPeriods ? 'Period' : 'Quarter';
            const start = userTimes[`start${i}`];
            const end = userTimes[`end${i}`];
            if (start && end) {
                timeButtonTray.appendChild(makeTimeButton(`${title}${i}`, i));
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
        ppTd.style.cssText += `padding-left: 0.3rem; padding-right: 0.5rem; text-align: left;`
        row.appendChild(ppTd);

        row.appendChild(makeTd(processPath.planned_hc));
        plannedTotal += processPath.planned_hc;
        const actualHc = parseFloat(parseFloat(processPath.actual_hc) / getTimeDiff().toFixed(1));
        row.appendChild(makeTd(actualHc.toFixed(1)));
        actualTotal += actualHc;
        row.appendChild(makeDeltaTd(processPath.planned_hc, actualHc));
        deltaTotal += actualHc - processPath.planned_hc;

        rowCount++;
        return row;
    }

    function makeRateRow(pathName, processPath) {
        const row = document.createElement('tr');
        row.style.backgroundColor = rowCount % 2 === 0 ? 'white' : '#e5e7eb';

        const ppTd = makeTd(pathName);
        ppTd.style.cssText += `padding-left: 0.3rem; padding-right: 0.5rem; text-align: left;`
        row.appendChild(ppTd);

        row.appendChild(makeTd(processPath.planned_rate));
        row.appendChild(makeTd(processPath.actual_rate));
        row.appendChild(makeDeltaTd(processPath.planned_rate, processPath.actual_rate));

        rowCount++;
        return row;
    }

    function makeCapacityRow(pathName, processPath) {
        const row = document.createElement('tr');
        row.style.backgroundColor = rowCount % 2 === 0 ? 'white' : '#e5e7eb';

        const ppTd = makeTd(pathName);
        ppTd.style.cssText += `padding-left: 0.3rem; padding-right: 0.5rem; text-align: left;`
        row.appendChild(ppTd);

        const plannedCapacity = processPath.planned_rate * processPath.planned_hc * getTimeDiff();
        plannedCapacityTotal += plannedCapacity;
        row.appendChild(makeTd(plannedCapacity.toFixed(1)));

        const actualCapacity = processPath.actual_rate * processPath.actual_hc;
        actualCapacityTotal += actualCapacity;
        row.appendChild(makeTd(actualCapacity.toFixed(1)));

        const capacityDelta = actualCapacity - plannedCapacity;
        capacityDeltaTotal += capacityDelta;
        row.appendChild(makeDeltaTd(plannedCapacity, actualCapacity));

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

        row.appendChild(makeTd(data.planned_hc));
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
            row.appendChild(makeTd(plannedQuantity));
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

    function makeCalculateButton() {
        const button = document.createElement('button');
        button.setAttribute('id', 'calculate-btn');
        button.textContent = 'Calculate';
        button.style.cssText += `font-size: 16px; width: 10rem; margin-top: 2rem; border: none; align-self: center;`;

        return button;
    }

    /*****************\
    |DOM element logic|
    \*****************/

    function openModal() {
        const modal = document.getElementById('modal');
        modal.style.zIndex = '1000';
        modal.style.position = 'fixed';
        modal.style.top = '20%';
        modal.style.left = '35%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        modal.style.justifyContent = 'center';
        modal.style.padding = '3rem';
        modal.style.color = 'white';
    
        // const slaDiv = document.getElementById('sla-div');
        // slaDiv.remove();
    }

    function closeModal() {
        const modal = document.getElementById('modal');
        modal.style.display = 'none';


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
        if (Math.abs(document.getElementById('startHourIntraday').value - document.getElementById('endHourIntraday').value) < 7) {
            loadTableData();
        }
    }   

    // save the inputs into local storage with the fc as the key
    function saveModalSettings(e) {
        const parent = e.target.parentElement;
        const inputs = Array.from(parent.querySelectorAll('input'));
        const timeObject = {
            start1: inputs[0].value,
            end1: inputs[1].value,
            start2: inputs[2].value,
            end2: inputs[3].value,
            start3: inputs[4].value,
            end3: inputs[5].value,
            start4: inputs[6].value,
            end4: inputs[7].value,
            start5: inputs[8].value,
            end5: inputs[9].value 
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
        console.log('in loadTableData');
        const planTime = await getPlanTime();
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
            makeManualPickTable();
        } else {
            const pickData = await makePickDataObject(planTime);
            console.log(pickData);
            const parent = document.getElementsByClassName('row')[0];

            const div = document.createElement('div');
            div.setAttribute('id', 'main-div');
            div.style.cssText += `display: flex; flex-direction: column; margin-top: 4rem`;

            const p = document.createElement('p');
            const date = planTime.split('T')[0];
            const time = planTime.split('T')[1].replace('Z', '');
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

            parent.prepend(div);
        }
    }

    async function loadPackTable(planTime) {
        // if undefined make a table that allows manual inputs for calculation
        if (!planTime) {
            makeManualPackTable();
        } else {
            const packData = await makePackDataObject(planTime);
            console.log(packData);
            const parent = document.getElementsByClassName('row')[0];

            const div = document.createElement('div');
            div.setAttribute('id', 'main-div');
            div.style.cssText += `display: flex; flex-direction: column; margin-top: 4rem`;

            const p = document.createElement('p');
            const date = planTime.split('T')[0];
            const time = planTime.split('T')[1].replace('Z', '');
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

            parent.prepend(div);
        }
    }

    async function loadRebinTable(planTime) {
        // if undefined make a table that allows manual inputs for calculation
        if (!planTime) {
            makeManualRebinTable();
        } else {
            const rebinData = await makeRebinDataObject(planTime);
            console.log(rebinData);
            const parent = document.getElementsByClassName('row')[0];

            const div = document.createElement('div');
            div.setAttribute('id', 'main-div');
            div.style.cssText += `display: flex; flex-direction: column; margin-top: 4rem`;

            const p = document.createElement('p');
            const date = planTime.split('T')[0];
            const time = planTime.split('T')[1].replace('Z', '');
            p.textContent = `Data pulled from plan uploaded at ${time}, ${date}`;
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
    
    /**************\
    |plan API logic|
    \**************/
    // return the time of the plan most relevant to time period selected which will be the plan with time closest to start time of that quarter/period
    async function getPlanTime() {
        console.log('in getplantime')
        const allPlans = await getPlanTimes();
        const allPlansData = JSON.parse(allPlans);
        const planTimes = getFcPlanTimes(allPlansData);

        const startDateString = document.getElementById('startDateIntraday').value;
        const startHour = document.getElementById('startHourIntraday').value;
        const startMinute = document.getElementById('startMinuteIntraday').value;
        const startDate = new Date(startDateString.split('/')[0], startDateString.split('/')[1] - 1, startDateString.split('/')[2], startHour, startMinute);

        // only accept plans less than 70 minutes from start of the period/quarter
        let closestPlanTime = 70;
        let closestPlan;
        for (const planTime of planTimes) {
            const date = planTime.split('T')[0];
            const year = date.split('-')[0];
            const month = date.split('-')[1] - 1;
            const day = date.split('-')[2];
            const time = planTime.split('T')[1];
            const hour = time.split(':')[0];
            const minute = time.split(':')[1];
            const planDate = new Date(year, month, day, hour, minute);
            const difference = Math.abs(planDate - startDate) / 60000;
            if (difference < closestPlanTime) {
                closestPlanTime = difference;
                closestPlan = planTime;
            }
            
        }

        console.log(`closest plan is ${closestPlan}`);

        return closestPlan;
    }


    // calls the big table data and filters for the plan times of the specific fc
    function getPlanTimes() {
        console.log('getting plan times');
        return new Promise(function(resolve) {
            GM.xmlHttpRequest({
                method: 'GET',
                url: getBigTableLink(),
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

    // returns the link to call the big table api, which uses 20 hours ago from the current time 
    function getBigTableLink() {
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - 20);

        const year = startDate.getFullYear();
        const month = parseInt(startDate.getMonth()) + 1 < 10 ? `0${parseInt(startDate.getMonth()) + 1}` : parseInt(startDate.getMonth()) + 1;
        const day = startDate.getDate() < 10 ? `0${startDate.getDate()}` : startDate.getDate();
        const hour = startDate.getHours() < 10 ? `0${startDate.getHours()}` : startDate.getHours();

        return `https://ecft.fulfillment.a2z.com/api/NA/nssp/get_nssp_big_table_new?fcSelected=ABE4%2CACY2%2CAKR1%2CAMA1%2CCHA2%2CCHO1%2CDEN8%2CFAT2%2CFOE1%2CFTW5%2CGEG2%2CHOU8%2CHSV1%2CICT2%2CIGQ2%2CILG1%2CIND2%2CLAS6%2CLFT1%2CLGB6%2CLIT2%2CMCE1%2CMCO2%2CMDT4%2CMDW6%2CMDW9%2COKC2%2CPDX7%2CPHL6%2CPHX5%2CPHX7%2CSAT4%2CSCK1%2CSJC7%2CSLC2%2CSMF6%2CSTL3%2CSTL4%2CSWF1%2CTEB4%2CTPA3%2CYEG1&region=NA&startDate=${year}-${month}-${day}&startTime=${hour}%3A00%3A00`
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

            allPickData[`${processPath}`]['planned_hc'] = parsedPickData[i].planned_hc_hr;
            allPickData[`${processPath}`]['actual_hc'] = actualsData ? actualsData[5].textContent : 0;

            allPickData[`${processPath}`]['planned_rate'] = parseFloat(parsedPickData[i].rate_pick.toFixed(1));
            allPickData[`${processPath}`]['actual_rate'] = actualsData ? actualsData[7].textContent : 0;

            allPickData[`${processPath}`]['planned_quantity_hr'] = Math.round(parsedPickData[i].planned_hc_hr * parsedPickData[i].rate_pick);
            allPickData[`${processPath}`]['actual_quantity'] = actualsData ? actualsData[2].textContent : 0;
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
            allPackData[`${processPath}`]['actual_hc'] = actualsData ? actualsData[5].textContent : 0;

            allPackData[`${processPath}`]['planned_rate'] = parseFloat(parsedPackData[i].rate_pack.toFixed(1));
            allPackData[`${processPath}`]['actual_rate'] = actualsData ? actualsData[7].textContent : 0;

            allPackData[`${processPath}`]['planned_quantity_hr'] = Math.round(parsedPackData[i].hc_pack * parsedPackData[i].rate_pack);
            allPackData[`${processPath}`]['actual_quantity'] = actualsData ? actualsData[2].textContent : 0;
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
        
        if (endHour > startHour) { // for times not crossing over midnight
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

})(); 


