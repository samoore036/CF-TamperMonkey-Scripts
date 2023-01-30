**Purpose:**
This plugin is designed to replace OWL which is used by CF (Central Flow) and FCs alike to track actual pick hcs in FC Console against set TURs. With CF transitioning to 2 to 1, this plugin was made to reduce external applications and keep all relevant tools centralized in existing web tools. By attaching this plugin to the top of FC Console, the goal is to increase visibility of actual vs set pick settings to increase staffing to plan metrics. 

**How it works**:
The plugin utilizes localStorage API to store the user's preferences for what paths to track and in which categories. The first time a user loads into the page, no paths will display. Users can click on the settings tab to choose which paths will display. Categories are CE (customer experience), TSO (transship out), and Vrets (vendor returns). Once a user chooses their paths to display, local storage will save these preferences for future sessions. 

Local storage organizes keys by pulling the fc code from the URL. It then creates three key categories: ${fc}-ce, ${fc}-tso, and ${fc}-vrets. When a user adds or removes a path to/from a category, an array for that category is updated for those changes and pushed to local storage. Whenever FC Console is loaded in, paths will automatically populate by accessing local storage. Keys are saved as JSON-stringified arrays and are accessed as JSON-parsed strings. 

Local storage was chosen as the preferences will save session to session. This allows the user to choose which paths to put into which categories for their own tracking. Rodeo was not used to pull paths as Rodeo is dynamically created and it is not possible to fetch paths from Rodeo with XMLHttpRequests or by using the Fetch API. 

Upon load, the plugin will wait for 5 seconds before loading in. This is because FC Console is also dynamically generated and needs time to load elements. ReadyStateChange and window/document.loaded have been tested and do not work. If a user is still not able to load in after 5 seconds repeatedly, they are prompted to contact @mooshahe for a fix. 

Once the plugin loads in, async calls are made to each path pulled from local storage. The async calls grab the path's status, set PRA (pick rate average), and TUR (target unit rate). Actual pick hcs are calculated by TUR/PRA. Once the information for all paths is resolved, the table will populate with current vs actual metrics.

Also on load, only the CE table will display. The TSO and Vrets tables can be toggled. This is to keep focus on the customer and is the most value-added category.

![image](https://user-images.githubusercontent.com/104536361/215573281-fb2e688f-c2a4-4299-865f-cd4464f9b605.png)

![image](https://user-images.githubusercontent.com/104536361/215573320-b0d3d583-213d-41be-aa6d-352ae616b68a.png)


