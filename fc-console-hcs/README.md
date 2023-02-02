**Purpose:**
This plugin is designed to replace OWL which is used by CF (Central Flow) and FCs alike to track actual pick hcs in FC Console against set TURs. With CF transitioning to 2 to 1, this plugin was made to reduce external applications and keep all relevant tools centralized in existing web tools. By attaching this plugin to the top of FC Console, the goal is to increase visibility of actual vs set pick settings to increase staffing to plan metrics.

**Setup:**
1. On the main process path page of FC Console, click on settings.

![image](https://user-images.githubusercontent.com/104536361/216234543-ca1741fb-bf14-42f3-b4fb-bb6b36db577d.png)

2. Select ALL under Page Size

![image](https://user-images.githubusercontent.com/104536361/216234682-bbe5ec93-c986-42be-ab85-e449039a1876.png)

3. Also under settings, ensure every column is visible

![image](https://user-images.githubusercontent.com/104536361/216234736-4ec3e995-9472-4ae7-ae6b-60e712effa5c.png)

4. Click confirm, reload and it will start working.

**Note**: To get latest data, you must either refresh or use the auto refresh option.

**How it works**:
The plugin utilizes localStorage API to store the user's preferences for what paths to track and in which categories. The first time a user loads into the page, no paths will display. Users can click on the settings tab to choose which paths will display. Categories are CE (customer experience), TSO (transship out), and Vrets (vendor returns). Once a user chooses their paths to display, local storage will save these preferences for future sessions. 

Local storage organizes keys by pulling the fc code from the URL. It then creates three key categories: ${fc}-ce, ${fc}-tso, and ${fc}-vrets. When a user adds or removes a path to/from a category, an array for that category is updated for those changes and pushed to local storage. Whenever FC Console is loaded in, paths will automatically populate by accessing local storage. Keys are saved as JSON-stringified arrays and are accessed as JSON-parsed strings. 

Local storage was chosen as the preferences will save session to session. This allows the user to choose which paths to put into which categories for their own tracking. Rodeo was not used to pull paths as Rodeo is dynamically created and it is not possible to fetch paths from Rodeo with XMLHttpRequests or by using the Fetch API. 

FC Console has an API that shows all path settings. Upon load, the plugin will first fetch the JSON data for all process paths. After, it will check in one second intervals until the DOM is fully loaded. Once it is loaded, the rest of the plugin's functions will execute. An interval is used because FC Console is also dynamically generated and needs time to load elements. ReadyStateChange and window/document.loaded have been tested and do not work. 

Once the plugin function runs, the DOM will be loaded and the tables will populate data using set data from the API and actual data from the same page in FC Console. Also on load, only the CE table will display. The TSO and Vrets tables can be toggled. This is to keep focus on the customer and is the most value-added category.

On load: 
![image](https://user-images.githubusercontent.com/104536361/216234274-e03831fe-d58e-46b8-9acf-db14c189c5b9.png)

Expanded tables:

![image](https://user-images.githubusercontent.com/104536361/216234309-a82f4045-b220-402d-aac2-6a92cf7f0e8b.png)

Settings:

![image](https://user-images.githubusercontent.com/104536361/216234339-7711ae6f-5102-4950-986b-f88f484aadb0.png)



