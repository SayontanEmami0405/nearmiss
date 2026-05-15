sap.ui.define([], function () {
    "use strict";

    return {
        formatStatus: function (status) {
            console.log("Formatter input:", status);
            const statusMap = {
                "S10": "Draft Saved",
                "S20": "Submitted"
            };
            return statusMap[status] || status;
        },

        createCustomData: function (index) {
            return [{
                key: "index",
                value: index
            }];
        },
        formatODataDate: function (sOdataDate) {
            debugger;
            if (!sOdataDate) return "";

            try 
                {var iTimestamp = parseInt(sOdataDate.replace(/\/Date\((\d+)\)\//, "$1"), 10);
                var oDate = new Date(iTimestamp);

                var oDateFormat = DateFormat.getDateInstance({ pattern: "dd/MM/yyyy" });
                return oDateFormat.format(oDate);
            } catch (e) {
                return "";
            }
        }
    };
});