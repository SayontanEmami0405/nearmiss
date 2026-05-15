sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../model/formatter",
], function (Controller, MessageToast, BusyIndicator, MessageBox, Filter, FilterOperator, formatter) {
    "use strict";

    return Controller.extend("com.emami.nearmiss.controller.Initiator", {
        formatter: formatter,
        onInit: function () {

            // Load jsonCentralModel from external JSON file
            var oJsonModel = new sap.ui.model.json.JSONModel();
            oJsonModel.loadData("model/jsonCentralModel.json"); // adjust path if needed
            this.getView().setModel(oJsonModel, "jsonCentralModel");

            // Optional: Attach route if using router
            var oRouter = this.getOwnerComponent().getRouter();
            if (oRouter) {
                oRouter.getRoute("RouteInitiator").attachPatternMatched(this._onObjectMatched, this);
            }
        },

        _onObjectMatched: function (oEvent) {
            // You can do pre-fill or fetch logic when route matches
            console.log("Initiator Route Matched");
            var that = this;
            const oDataModel = that.getView().getModel();
            // BusyIndicator.show();
 
            oDataModel.read("/ZNMPLANTSET", {
                success: function (oSuccess) {
                    BusyIndicator.hide();
                    var oJsonPlantListModel = that.getView().getModel("jsonPlantListModel");
                    oJsonPlantListModel.setData(oSuccess.results);
                },

                error: function (oError) {

                }
            });
            oDataModel.read("/MATERIALDETSet", {
                success: function (oSuccess) {
                    BusyIndicator.hide();

                    var oJsonMatCodeModel = that.getView().getModel("jsonMatCodeModel");
                    var aData = oSuccess.results;

                    // -------- SORTING LOGIC -------- 
                    aData.sort(function (a, b) {
                        // If MatCode contains only numbers → numeric sort
                        if (!isNaN(a.MatCode) && !isNaN(b.MatCode)) {
                            return Number(a.MatCode) - Number(b.MatCode);
                        }

                        // Otherwise alphabetical sort
                        return a.MatCode.localeCompare(b.MatCode);
                    });
                    // --------------------------------

                    oJsonMatCodeModel.setData(aData);
                },

                error: function () {
                    BusyIndicator.hide();
                    MessageToast.show("Failed to load material list");
                }
            });

            oDataModel.read("/Dropdown", {
                success: function (oSuccess) {

                    var aData = oSuccess.results;

                    var STEXT = [];
                    var PRISK = [];
                    var AFAREA = [];

                    STEXT.unshift({ ZdropVal: "", ZdropId: "STEXT" });
                    PRISK.unshift({ ZdropVal: "", ZdropId: "PRISK" });
                    AFAREA.unshift({ ZdropVal: "", ZdropId: "AFAREA" });

                    aData.forEach(function (item) {
                        if (item.ZdropId === "STEXT") {
                            STEXT.push(item);
                        } else if (item.ZdropId === "PRISK") {
                            PRISK.push(item);
                        } else if (item.ZdropId === "AFAREA") {
                            AFAREA.push(item);
                        }
                    });
                    var ojsonDropDown = that.getView().getModel("jsonDropDown");
                    ojsonDropDown.setProperty("/STEXT", STEXT);
                    ojsonDropDown.setProperty("/PRISK", PRISK);
                    ojsonDropDown.setProperty("/AFAREA", AFAREA);

                    BusyIndicator.hide();
                },

                error: function (oError) {
                    BusyIndicator.hide();
                }
            });



        },

        onCAPATypeSelect: function (oEvent) {
            // Get selected RadioButton
            var oRadioGroup = oEvent.getSource();
            var iSelectedIndex = oRadioGroup.getSelectedIndex();
            var oSelectedButton = oRadioGroup.getButtons()[iSelectedIndex];
            var sType = oSelectedButton.data("type"); // "CA" or "PA"

            const oModel = this.getView().getModel("jsonCentralModel");
            oModel.setProperty("/Data/SelectedCapaType", sType);

            const aList = sType === "C"
                ? oModel.getProperty("/Data/CorrectiveList")
                : oModel.getProperty("/Data/PreventiveList");

            oModel.setProperty("/Data/VisibleCapaList", aList);
            oModel.refresh(true);

            sap.m.MessageToast.show(sType === "C" ? "Corrective Actions" : "Preventive Actions");
        },

        onAddCAPARow: function () {
            const oModel = this.getView().getModel("jsonCentralModel");
            const sType = oModel.getProperty("/Data/SelectedCapaType");
            const sPath = sType === "C" ? "/Data/CorrectiveList" : "/Data/PreventiveList";
            this._checkFinalSubmissionStatus();

            let aList = oModel.getProperty(sPath) || [];
            if (aList.length >= 10) {
                sap.m.MessageToast.show("Max 10 actions allowed");
                return;
            }

            aList.push({
                ActionDetail: "",
                Responsibility: "",
                TargetDate: "",
                Status: "Open",
                Type: sType
            });

            oModel.setProperty(sPath, aList);
            oModel.setProperty("/Data/VisibleCapaList", aList); // refresh table
            oModel.refresh(true);
        },
        onDeleteCAPARow: function (oEvent) {
            const oModel = this.getView().getModel("jsonCentralModel");

            // Get index of clicked row
            const oItem = oEvent.getSource().getParent();
            const sPath = oItem.getBindingContext("jsonCentralModel").getPath();
            const iIndex = parseInt(sPath.split("/").pop());
            this._checkFinalSubmissionStatus();

            // Detect current CAPA type (C or P)
            const sType = oModel.getProperty("/Data/SelectedCapaType");
            const sListPath = sType === "C" ? "/Data/CorrectiveList" : "/Data/PreventiveList";

            // Get list
            let aList = oModel.getProperty(sListPath) || [];

            // Remove selected index
            aList.splice(iIndex, 1);

            // Update model
            oModel.setProperty(sListPath, aList);
            oModel.setProperty("/Data/VisibleCapaList", aList);
            oModel.refresh(true);

            sap.m.MessageToast.show("Row deleted");
        },
        _checkFinalSubmissionStatus: function () {


            const oModel = this.getView().getModel("jsonCentralModel");

            const aCorrective = oModel.getProperty("/Data/CorrectiveList") || [];
            const aPreventive = oModel.getProperty("/Data/PreventiveList") || [];

            // combine both lists
            const aAll = [...aCorrective, ...aPreventive];

            // no rows → hide visibility of 
            if (aAll.length === 0) {
                oModel.setProperty("/Visible/InitiatorInitiateBtn", false);
                return;
            }

            // check if ANY open exists
            const bAnyOpen = aAll.some(item => item.Status === "Open");

            // show only if ALL closed
            oModel.setProperty("/Visible/InitiatorInitiateBtn", !bAnyOpen);
        },
        // _checkFinalSubmissionStatus: function () {
        //     debugger;
        //     const oModel = this.getView().getModel("jsonCentralModel");

        //     // Get current visible CAPA list (table data)
        //     const aList = oModel.getProperty("/Data/VisibleCapaList") || [];

        //     // Check: All Status must be "Close"
        //     const bAllClosed = aList.length > 0 && aList.every(item => item.Status === "Open");

        //     // Set Final Submit Button enabled/disabled
        //     // this.byId("btnFinalSubmit").setEnabled(bAllClosed);
        //     if (aList.length === 0) {
        //         oModel.setProperty("/Visible/InitiatorInitiateBtn", false);
        //     }
        //     else if (bAllClosed) {
        //         oModel.setProperty("/Visible/InitiatorInitiateBtn", true);
        //     }
        //     else {
        //         oModel.setProperty("/Visible/InitiatorInitiateBtn", false);
        //     }
        // },

        // onAddCAPARow: function () {
        //     // Get the central model
        //     debugger;
        //     const oJsonCentralModel = this.getView().getModel("jsonCentralModel");
        //     let aCAPAList = oJsonCentralModel.getProperty("/Data/CAPAList");

        //     if (!Array.isArray(aCAPAList)) {
        //         aCAPAList = [];
        //     }

        //     if (aCAPAList.length >= 10) {
        //         sap.m.MessageToast.show("You can add up to 10 CAPA rows only!");
        //         return;
        //     }

        //     const maxSlNo = aCAPAList.length > 0
        //         ? aCAPAList.reduce((max, item) => (item.SlNo > max ? item.SlNo : max), 0)
        //         : 0;

        //     aCAPAList.push({
        //         SlNo: maxSlNo + 1,
        //         ActionDetail: "",
        //         Responsibility: "",
        //         TargetDate: "",
        //         Status: "Open",
        //         isTemporary: true
        //     });

        //     oJsonCentralModel.setProperty("/Data/CAPAList", aCAPAList);
        //     oJsonCentralModel.refresh(true);
        // },

        onSaveNearMiss: function () {
            const oView = this.getView();
            var that = this;
            const oODataModel = oView.getModel(); // OData model
            const oCentralModel = oView.getModel("jsonCentralModel"); // JSON model

            const oCentral = oCentralModel.getProperty("/Data");
            const oFormData = oCentral.FormData;
            // let sUI5Date = oFormData.NmDate;  // "03/12/2025"

            // // Convert dd/MM/yyyy → yyyy-MM-dd
            // const [dd, mm, yyyy] = sUI5Date.split("/");
            // const sBackendDate = `${yyyy}-${mm}-${dd}`;

            // oFormData.NmDate = sBackendDate;

            // Corrective & Preventive lists
            const aCorrective = oCentral.CorrectiveList || [];
            const aPreventive = oCentral.PreventiveList || [];

            // Merge lists with proper Type + SlNumber + NmNumber
            let slCounter = 1;

            const aMergedCAPAList = [...aCorrective, ...aPreventive].map(item => {
                const isCorrective = aCorrective.includes(item);
                return {
                    ...item,

                    // C or P
                    Type: item.Type || (isCorrective ? "C" : "P"),

                    // Assign SL Number sequentially
                    SlNumber: slCounter++,

                    // Attach NmNumber to each row
                    NmNumber: oFormData.NmNumber
                };
            });

            // Update JSON model
            oCentralModel.setProperty("/Data/CAPAList", aMergedCAPAList);

            console.log("Merged CAPA List:", aMergedCAPAList);

            if (aMergedCAPAList.length === 0) {

            }


            // Required field validation
            const missing = [];

            if (!oFormData.Plant) missing.push("Plant");
            if (!oFormData.NmDate) missing.push("NM Date");
            if (!oFormData.Material) missing.push("Material");

            if (missing.length > 0) {
                MessageBox.error(
                    "Please fill the following fields:\n\n" + missing.join("\n")
                );
                return; // Stop save
            }

            // Build Final Payload for OData
            const payloadFinal = {
                ...oFormData,
                Flag: 'D',
                NEARMISSCAPA: aMergedCAPAList.map(item => ({
                    CapaType: item.Type,
                    SlNumber: item.SlNumber,
                    NmNumber: item.NmNumber,
                    Actionv: item.Actionv,
                    Responsibility: item.Responsibility,
                    TargetDate: item.TargetDate,
                    Status: item.Status
                }))
            };


            oODataModel.create("/ZNEARMISSSet", payloadFinal, {
                success: function (oData) {
                    sap.m.MessageToast.show("Saved successfully!");
                    oCentralModel.setProperty("/Data/FormData/NmNumber", oData.NmNumber);
                    oCentralModel.setProperty("/Visible/printBtn", true);
                    oCentralModel.setProperty("/Visible/ShowAttachFrag", true);
                    that._checkFinalSubmissionStatus();
                },
                error: function (oError) {
                    sap.m.MessageBox.error("Error while saving data!");

                }
            });

        },
        onPressInitateApproval: function () {
            const oView = this.getView();
            const oODataModel = oView.getModel(); // OData model
            const oCentralModel = oView.getModel("jsonCentralModel"); // JSON model

            const oCentral = oCentralModel.getProperty("/Data");
            const oFormData = oCentral.FormData;

            // Corrective & Preventive lists
            const aCorrective = oCentral.CorrectiveList || [];
            const aPreventive = oCentral.PreventiveList || [];

            // Merge lists with proper Type + SlNumber + NmNumber
            let slCounter = 1;

            const aMergedCAPAList = [...aCorrective, ...aPreventive].map(item => {
                const isCorrective = aCorrective.includes(item);
                return {
                    ...item,

                    // C or P
                    Type: item.Type || (isCorrective ? "C" : "P"),

                    // Assign SL Number sequentially
                    SlNumber: slCounter++,

                    // Attach NmNumber to each row
                    NmNumber: oFormData.NmNumber
                };
            });

            // Update JSON model
            debugger;
            oCentralModel.setProperty("/Data/CAPAList", aMergedCAPAList);

            console.log("Merged CAPA List:", aMergedCAPAList);

            // Build Final Payload for OData
            const payloadFinal = {
                ...oFormData,
                Flag: 'S',
                NEARMISSCAPA: aMergedCAPAList.map(item => ({
                    CapaType: item.Type,
                    SlNumber: item.SlNumber,
                    NmNumber: item.NmNumber,
                    Actionv: item.Actionv,
                    Responsibility: item.Responsibility,
                    TargetDate: item.TargetDate,
                    Status: item.Status
                }))
            };

            let oEditable = oCentralModel.getProperty("/Editable");


            oODataModel.create("/ZNEARMISSSet", payloadFinal, {
                success: function (oData) {
                    sap.m.MessageToast.show("Saved successfully!");
                    oCentralModel.setProperty("/Data/FormData/NmNumber", oData.NmNumber);
                    oCentralModel.setProperty("/Visible/InitiatorInitiateBtn", false);
                    oCentralModel.setProperty("/Visible/InitiatorSaveBtn", false);
                    oCentralModel.setProperty("/Visible/RowDel", false);
                    oCentralModel.setProperty("/Visible/AttachementDeleteBtn", false);
                    oCentralModel.setProperty("/Visible/AddLineItem", false);
                    oCentralModel.setProperty("/Visible/FileUploaderControl", false);
                    oCentralModel.setProperty("/Visible/UploadFileDialogBtn", false);
                    oCentralModel.setProperty("/Visible/UploadFileBtn", false);

                    // Loop and set everything to false
                    Object.keys(oEditable).forEach(key => {
                        oEditable[key] = false;
                    });
                    oCentralModel.setProperty("/Editable", oEditable);



                },
                error: function (oError) {
                    sap.m.MessageBox.error("Error while saving data!");
                    console.error(oError);
                }
            });

        },


        _saveCAPALists: function (sNmNumber, oCentral) {
            const oModel = this.getView().getModel();
            const aAllCAPA = [...oCentral.CorrectiveList, ...oCentral.PreventiveList];

            if (!aAllCAPA.length) {
                sap.m.MessageToast.show("No CAPA actions to save");
                return;
            }

            oModel.setUseBatch(true);
            oModel.setDeferredGroups(["CAPA"]);

            aAllCAPA.forEach((item) => {
                const oPayload = {
                    NmNumber: sNmNumber,
                    CapaType: item.Type,
                    ActionDetail: item.ActionDetail,
                    Responsibility: item.Responsibility,
                    TargetDate: item.TargetDate,
                    Status: item.Status
                };
                oModel.create("/CapaActionSet", oPayload, { groupId: "CAPA" });
            });

            oModel.submitChanges({
                groupId: "CAPA",
                success: () => sap.m.MessageToast.show("All CAPA actions saved successfully"),
                error: () => sap.m.MessageBox.error("Error while saving CAPA actions")
            });
        },


        onFinalSubmit: function () {
            // Validate CAPA statuses: all should be "Close"
            var oData = this.getView().getModel("jsonCentralModel").getData();
            var aOpenCAPA = oData.Data.CAPAList.filter(function (item) {
                return item.Status === "Open";
            });

            if (aOpenCAPA.length > 0) {
                MessageToast.show("Cannot submit! All CAPA statuses must be 'Close'.");
                return;
            }

            // Proceed with final submission
            console.log("Final submission data:", oData);
            MessageToast.show("Form submitted successfully!");
        },
        onValueHelpPlant: function () {
            var that = this;
            if (!that.PlantListDialog) {
                that.PlantListDialog = sap.ui.xmlfragment("com.emami.nearmiss.view.fragments.PlantDialog", that);
                that.getView().addDependent(that.PlantListDialog);
            }
            that.PlantListDialog.open();
        },
        onSearchPlantDialog: function (oEvent) {
            var sValue = oEvent.getParameter("value");

            var oFilter = new sap.ui.model.Filter({
                filters: [
                    new Filter("Plant_Code", sap.ui.model.FilterOperator.Contains, sValue),
                    new Filter("Plant_Name", sap.ui.model.FilterOperator.Contains, sValue)
                ],
                and: false
            });
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
        },
        onPressPlantDialogLineItem: function (oEvent) {
            var Plant = oEvent.getParameter("selectedItem").getCells()[0].getText();
            let that = this;
            const oDataModel = that.getOwnerComponent().getModel();

            // this.byId('idInputWipCode').setValue(Matnr);
            // this.byId('idInputUnitCode').setValue(Werks);
            let oJsonCentralModel = this.getView().getModel("jsonCentralModel");
            oJsonCentralModel.setProperty("/Data/FormData/Plant", Plant);
            oJsonCentralModel.refresh();

            var aFilters = [
                new sap.ui.model.Filter("Plant", FilterOperator.EQ, Plant)
            ];
            BusyIndicator.show();

            oDataModel.read("/LineVesselSet", {
                filters: aFilters,
                success: function (oSuccess) {

                    BusyIndicator.hide();
                    debugger;
                    var oJsonLineVesselModel = that.getView().getModel("jsonLineVesselModel");
                    oJsonLineVesselModel.setData(oSuccess.results);
                },
                error: function (oError) {
                    console.log(oError);
                    BusyIndicator.hide();
                    sap.m.MessageToast.show("Failed to load list.");
                }
            });

        },
        onValueHelpReqMatCode: function () {
            var that = this;
            if (!that.MatCodeListDialog) {
                that.MatCodeListDialog = sap.ui.xmlfragment("com.emami.nearmiss.view.fragments.MaterialDialog", that);
                that.getView().addDependent(that.MatCodeListDialog);
            }
            that.MatCodeListDialog.open();
        },
        onSearchMatCodeDialog: function (oEvent) {
            var sValue = oEvent.getParameter("value");

            var oFilter = new sap.ui.model.Filter({
                filters: [
                    new Filter("MatCode", sap.ui.model.FilterOperator.Contains, sValue),
                    new Filter("MatDes", sap.ui.model.FilterOperator.Contains, sValue),
                    new Filter("Sku", sap.ui.model.FilterOperator.Contains, sValue),

                ],
                and: false
            });
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
        },
        onPressMatCodeDialogLineItem: function (oEvent) {
            var MatCode = oEvent.getParameter("selectedItem").getCells()[0].getText();
            var MatDescription = oEvent.getParameter("selectedItem").getCells()[1].getText();
            var Sku = oEvent.getParameter("selectedItem").getCells()[2].getText();

            // this.byId('idInputWipCode').setValue(Matnr);
            // this.byId('idInputUnitCode').setValue(Werks);
            let oJsonCentralModel = this.getView().getModel("jsonCentralModel");
            oJsonCentralModel.setProperty("/Data/FormData/Material", MatCode);
            oJsonCentralModel.setProperty("/Data/FormData/MatDes", MatDescription);
            oJsonCentralModel.setProperty("/Data/FormData/Sku", Sku);
            oJsonCentralModel.refresh();

        },
        onValueHelpReqLineVessel: function () {
            var that = this;
            if (!that.LineVesselListDialog) {
                that.LineVesselListDialog = sap.ui.xmlfragment("com.emami.nearmiss.view.fragments.LineVesselDialog", that);
                that.getView().addDependent(that.LineVesselListDialog);
            }
            that.LineVesselListDialog.open();
        },
        onSearchLineVesselDialog: function (oEvent) {
            var sValue = oEvent.getParameter("value");

            var oFilter = new sap.ui.model.Filter({
                filters: [
                    new Filter("Line", sap.ui.model.FilterOperator.Contains, sValue),
                    new Filter("Vessel", sap.ui.model.FilterOperator.Contains, sValue),

                ],
                and: false
            });
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
        },
        onPressLineDialogLineItem: function (oEvent) {
            var Line = oEvent.getParameter("selectedItem").getCells()[0].getText();
            var Vessel = oEvent.getParameter("selectedItem").getCells()[1].getText();
            let oJsonCentralModel = this.getView().getModel("jsonCentralModel");
            oJsonCentralModel.setProperty("/Data/FormData/Line", Line);
            oJsonCentralModel.setProperty("/Data/FormData/VesselName", Vessel);
            oJsonCentralModel.refresh();
        },
        onPressDRSearch: function () {

            const createDateFromYYYYMMDD = (dateString) => {
                if (!/^\d{8}$/.test(dateString)) {
                    throw new Error("Invalid date format. Please use YYYYMMDD.");
                }

                const year = parseInt(dateString.slice(0, 4), 10);
                const month = parseInt(dateString.slice(4, 6), 10) - 1; // Months are 0-indexed in JavaScript
                const day = parseInt(dateString.slice(6, 8), 10);

                return new Date(year, month, day);
            }
            let oDateRange = this.getView().byId("idDR");

            let dateRangeValue = oDateRange.getValue(); // Format: "dd.MM.yyyy - dd.MM.yyyy"

            let [startStr, , endStr] = dateRangeValue.split(' '); // extract both dates

            let StartDate = createDateFromYYYYMMDD(
                startStr.split('.')[2] + startStr.split('.')[1] + startStr.split('.')[0]
            );
            StartDate.setDate(StartDate.getDate() + 1);

            let EndDate = createDateFromYYYYMMDD(
                endStr.split('.')[2] + endStr.split('.')[1] + endStr.split('.')[0]
            );
            EndDate.setDate(EndDate.getDate() + 1);

            // let oCheckBox = this.getView().byId("idPendingWithMe");

            // let PendingWithMe = oCheckBox.getSelected() ? 'X' : '';

            // let oCheckAllCheckBox = this.getView().byId("idCheckAll");

            // let CheckAll = oCheckAllCheckBox.getSelected() ? 'X' : '';


            const formatDateForOData = (dateObj) => {
                return `/Date(${dateObj.getTime()})/`;
            };


            let that = this;
            const oDataModel = that.getOwnerComponent().getModel();
            var aFilters = [
                new sap.ui.model.Filter("NmDate", FilterOperator.BT, StartDate, EndDate),
                // new sap.ui.model.Filter("Action", FilterOperator.EQ, "I"),
                // new sap.ui.model.Filter("PendingCheck", FilterOperator.EQ, PendingWithMe)
                // new sap.ui.model.Filter("CheckAll", FilterOperator.EQ, CheckAll)
            ];
            BusyIndicator.show();

            oDataModel.read("/CRUDSet", {
                filters: aFilters,
                success: function (oSucess) {

                    BusyIndicator.hide();

                    that.getView().getModel("jsonNMSummaryModel").setData(null);
                    that.getView().getModel("jsonNMSummaryModel").setData(oSucess.results);
                },
                error: function (oError) {
                    console.log(oError);
                    BusyIndicator.hide();
                    sap.m.MessageToast.show("Failed to load Summary list.");
                }
            });
        },
        onItemPress: function (oEvent) {
            var that = this;
            let oSelecteditem = oEvent.getParameter("listItem");
            let oContext = oSelecteditem.getBindingContext("jsonNMSummaryModel");
            // let oData = oContext.getObject();
            let oData = this.getView().getModel("jsonNMSummaryModel").getProperty(oContext.sPath);
            // let oModel = this.getView().getModel("RevAppJsonModel");
            // let aData = oModel.getData();

            // if (!Array.isArray(aData)) {
            //     aData = aData.results || [];
            // }

            // let sUname = ""; // variable to hold single username

            // for (let i = 0; i < aData.length; i++) {
            //     if (aData[i].Type === "I" && aData[i].Uname) {
            //         sUname = aData[i].Uname;
            //         break; // stop after first match
            //     }
            // }

            // console.log("Reviewer username:", sUname);
            // if (oData.PendingWith !== sUname) {
            //     sUname = ""
            // }




            const NmNumber = oData?.NmNumber;
            this.fnGetData(NmNumber);
            this.fnLoadAttachementList(NmNumber, "I");

            return;
        },
        fnGetData: function (NmNumber) {
            let that = this;
            const oDataModel = that.getOwnerComponent().getModel();
            let oJsonCentralModel = this.getView().getModel("jsonCentralModel");
            NmNumber = encodeURIComponent(NmNumber);
            const sPath = `/ZNEARMISSSet(NmNumber='${NmNumber}')`;

            BusyIndicator.show();

            oDataModel.read(sPath, {
                urlParameters: {
                    "$expand": "NEARMISSCAPA"   // Navigation Property
                },
                success: function (oSucess) {

                    BusyIndicator.hide();


                    oJsonCentralModel.setProperty("/Data/FormData/NmNumber", oSucess?.NmNumber);
                    oJsonCentralModel.setProperty("/Data/FormData/Material", oSucess?.Material);
                    oJsonCentralModel.setProperty("/Data/FormData/Plant", oSucess?.Plant);
                    oJsonCentralModel.setProperty("/Data/FormData/NmDate", oSucess?.NmDate);
                    oJsonCentralModel.setProperty("/Data/FormData/MatDes", oSucess?.MatDes);
                    oJsonCentralModel.setProperty("/Data/FormData/Cost", oSucess?.Cost);
                    oJsonCentralModel.setProperty("/Data/FormData/DisposalWay", oSucess?.DisposalWay);
                    oJsonCentralModel.setProperty("/Data/FormData/Quantity", oSucess?.Quantity);
                    oJsonCentralModel.setProperty("/Data/FormData/RootCause", oSucess?.RootCause);
                    oJsonCentralModel.setProperty("/Data/FormData/AffectedArea", oSucess?.AffectedArea);
                    oJsonCentralModel.setProperty("/Data/FormData/ProbableRisk", oSucess?.ProbableRisk);
                    oJsonCentralModel.setProperty("/Data/FormData/NmDetBrief", oSucess?.NmDetBrief);
                    oJsonCentralModel.setProperty("/Data/FormData/NmDetHeading", oSucess?.NmDetHeading);
                    oJsonCentralModel.setProperty("/Data/FormData/QuanScrapped", oSucess?.QuanScrapped);
                    oJsonCentralModel.setProperty("/Data/FormData/Line", oSucess?.Line);
                    oJsonCentralModel.setProperty("/Data/FormData/VesselName", oSucess?.VesselName);
                    oJsonCentralModel.setProperty("/Data/FormData/Sku", oSucess?.Sku);

                    // that.getView().byId("revremark").setValue(oSucess?.RevRemark || "");

                    oJsonCentralModel.refresh();
                    let aItems = oSucess?.NEARMISSCAPA?.results || [];

                    let aCorrectiveList = [];
                    let aPreventiveList = [];

                    aItems.forEach(item => {
                        if (item.CapaType === "C") {
                            aCorrectiveList.push(item);
                        } else if (item.CapaType === "P") {
                            aPreventiveList.push(item);
                        }
                    });

                    // let oJsonCentral = that.getView().getModel("jsonCentralModel");
                    oJsonCentralModel.setProperty("/Data/CorrectiveList", aCorrectiveList);
                    oJsonCentralModel.setProperty("/Data/PreventiveList", aPreventiveList);

                    // Default list visible:
                    oJsonCentralModel.setProperty("/Data/VisibleCapaList", aCorrectiveList);

                    that.getView().getModel("jsonItemListModel").setData(null);
                    // that.getView().getModel("jsonItemListModel").setData(oSucess?.NEARMISSCAPA?.results);
                    that.getView().getModel("jsonItemListModel").setData(aItems);
                    debugger;

                    if (oSucess?.NmNumber) {
                        // oJsonCentralModel.setProperty("/Visible/FileUploaderControl", true);
                        // oJsonCentralModel.setProperty("/Visible/UploadFileBtn", true);

                        that._checkFinalSubmissionStatus();

                        that.fnLoadAttachementList(oSucess?.NmNumber, "InitiatorGet");
                    }

                    oJsonCentralModel.setProperty("/Visible/printBtn", true);
                    oJsonCentralModel.setProperty("/Visible/ShowAttachFrag", true);


                    //Status of the Workflow
                    if (oSucess?.Status === "S10") {

                        // oJsonCentralModel.setProperty("/Visible/InitiatorInitiateBtn", true);
                        oJsonCentralModel.setProperty("/Visible/InitiatorSaveBtn", true);
                        // that.getView().byId("revremark").setEditable(true);

                        oJsonCentralModel.setProperty("/Visible/AttachementDeleteBtn", true);
                        oJsonCentralModel.setProperty("/Visible/AddLineItem", true);
                        oJsonCentralModel.setProperty("/Visible/InitiatorDeleteBtn", true);
                        oJsonCentralModel.setProperty("/Visible/FileUploaderControl", true);
                        oJsonCentralModel.setProperty("/Visible/UploadFileDialogBtn", true);
                        oJsonCentralModel.setProperty("/Visible/UploadFileBtn", true);
                        oJsonCentralModel.setProperty("/Visible/RowDel", true);

                        let oEditable = oJsonCentralModel.getProperty("/Editable");

                        // Loop and set everything to false
                        Object.keys(oEditable).forEach(key => {
                            oEditable[key] = true;
                        });

                        // Update model
                        oJsonCentralModel.setProperty("/Editable", oEditable);

                        oJsonCentralModel.setProperty("/Editable/Sku", false);
                        oJsonCentralModel.setProperty("/Editable/VesselName", false);
                        oJsonCentralModel.setProperty("/Editable/MatDes", false);

                    }
                    else if (oSucess?.Status === "S20") {
                        oJsonCentralModel.setProperty("/Visible/AttachementDeleteBtn", false);
                        oJsonCentralModel.setProperty("/Visible/AddLineItem", false);
                        oJsonCentralModel.setProperty("/Visible/InitiatorSaveBtn", false);
                        oJsonCentralModel.setProperty("/Visible/InitiatorInitiateBtn", false);
                        oJsonCentralModel.setProperty("/Visible/InitiatorDeleteBtn", false);
                        oJsonCentralModel.setProperty("/Visible/FileUploaderControl", false);
                        oJsonCentralModel.setProperty("/Visible/UploadFileDialogBtn", false);
                        oJsonCentralModel.setProperty("/Visible/UploadFileBtn", false);
                        oJsonCentralModel.setProperty("/Visible/RowDel", false);

                        let oEditable = oJsonCentralModel.getProperty("/Editable");

                        // Loop and set everything to false
                        Object.keys(oEditable).forEach(key => {
                            oEditable[key] = false;
                        });

                        // Update model
                        oJsonCentralModel.setProperty("/Editable", oEditable);
                    }
                    else {
                        oJsonCentralModel.setProperty("/Visible/getDataBtn", false);
                        oJsonCentralModel.setProperty("/Visible/DeleteLineItem", false);
                        oJsonCentralModel.setProperty("/Visible/AddLineItem", false);
                        oJsonCentralModel.setProperty("/Visible/InitiatorSaveBtn", false);
                        oJsonCentralModel.setProperty("/Visible/InitiatorInitiateBtn", false);
                        oJsonCentralModel.setProperty("/Visible/InitiatorDeleteBtn", false);
                    }
                },
                error: function (oError) {
                    console.log(oError);
                    BusyIndicator.hide();
                    sap.m.MessageToast.show("Failed to load data.");
                }
            });
        },

        OnFileUpload: function () {
            let that = this;
            const oModel = that.getOwnerComponent().getModel();

            var oFileUploader = that.getView().byId("fileupload");

            let oJsonCentralModel = this.getView().getModel("jsonCentralModel");
            const TempData = JSON.parse(oJsonCentralModel.getJSON());
            const NmNumber = TempData?.Data?.FormData?.NmNumber;

            if (!NmNumber) {
                MessageBox.error("Nm Number is missing!");
                return;
            }

            var file = oFileUploader.oFileUpload.files[0];
            if (!file) {
                sap.m.MessageToast.show("Please choose a file.");
                return;
            }



            // Read file as Base64
            var reader = new FileReader();
            reader.onload = function (e) {
                var fileContent = e.target.result.split(",")[1]; // Extract Base64 data
                // var file = fileUploader.oFileUpload.files[0]; // Get file details
                var fileName = file.name;
                var fileExtension = file.name.split('.').pop().toUpperCase();

                // Create payload for backend
                // var fileExtension = file.name.split('.').pop().toUpperCase();
                var oNewEntry = {
                    "NmNumber": NmNumber,
                    "FileName": fileName,
                    "Filetype": fileExtension,
                    "Value": fileContent // Sending Base64 encoded file data
                };

                // Call OData create method
                oModel.create("/ZfileuploadSet", oNewEntry, {
                    success: function (oData) {
                        // MessageBox.success("File Uploaded Successfully!");

                        MessageBox.success(
                            "File Uploaded Successfully!", {
                            styleClass: !!that.getView().$().closest(".sapUiSizeCompact").length ? "sapUiSizeCompact" : "",
                            onClose: function () {
                                that.fnOnCloseFileUpload(NmNumber);
                            }
                        });
                    },
                    error: function (oError) {
                        MessageBox.error("File Upload Failed");
                    }
                });
            };

            // Read file
            reader.readAsDataURL(oFileUploader.oFileUpload.files[0]);
            // BusyIndicator.show();
            // setTimeout(() => {
            //     that.fnLoadAttachementList(NmNumber, "I");
            // }, 3000);

        },
        fnOnCloseFileUpload: function (NmNumber) {
            BusyIndicator.show();
            this.fnLoadAttachementList(NmNumber, "I");
            // setTimeout(() => {
            //     this.fnLoadAttachementList(NmNumber, "I");
            // }, 3000);
        },
        onPressDeleteFile: function (oEvent) {
            let that = this;
            const NmNumber = oEvent.getSource().getBindingContext("jsonAttachmentListModel").getObject().NmNumber;
            const SerialNum = oEvent.getSource().getBindingContext("jsonAttachmentListModel").getObject().SerialNum;
            const oDataModel = that.getOwnerComponent().getModel();
            BusyIndicator.show();
            let url = "/ZfileuploadSet(NmNumber='" + NmNumber + "',SerialNum=" + Number(SerialNum) + ")";
            oDataModel.remove(url, {
                success: function (oSucess) {
                    that.getView().getModel("jsonAttachmentListModel").setData(null);
                    // BusyIndicator.hide();
                    that.fnLoadAttachementList(NmNumber, "DeletedByInitator");
                },
                error: function (oError) {
                    console.log(oError);
                    BusyIndicator.hide();
                    sap.m.MessageToast.show("Something went wrong while deleting attachement.");
                }
            });
        },
        fnLoadAttachementList: function (NmNumber, sCallFrom) {

            var that = this;
            const oDataModel = that.getOwnerComponent().getModel();
            let oFilters = [];
            oFilters.push(new Filter("NmNumber", FilterOperator.EQ, NmNumber));
            if (sCallFrom == "I") {
                BusyIndicator.show();
            }
            oDataModel.read("/ZfileuploadSet", {
                filters: oFilters,
                success: function (oSucess) {

                    if (sCallFrom == "DeletedFromDialog" || sCallFrom == "ReadForDialog") {
                        that.getView().getModel("jsonDialogAttachmentListModel").setData(null);
                        that.getView().getModel("jsonDialogAttachmentListModel").setData(oSucess?.results);
                        that.getView().getModel("jsonDialogAttachmentListModel").refresh();
                    } else {
                        that.getView().getModel("jsonAttachmentListModel").setData(null);
                        that.getView().getModel("jsonAttachmentListModel").setData(oSucess?.results);
                        that.getView().getModel("jsonAttachmentListModel").refresh();
                    }

                    if (sCallFrom == "I") {
                        BusyIndicator.hide();
                        // MessageBox.success("File Uploaded Successfuly");
                        sap.m.MessageToast.show("Attachement list loaded.");
                    } else if (sCallFrom == "R") {
                        sap.m.MessageToast.show("Attachement list loaded.");
                    } else if (sCallFrom == "A") {
                        sap.m.MessageToast.show("Attachement list loaded.");
                    } else if (sCallFrom == "DeletedByInitator") {
                        BusyIndicator.hide();
                        MessageBox.success("Deleted Succesfully");
                        sap.m.MessageToast.show("Attachement list loaded.");
                    } else if (sCallFrom == "DeletedFromDialog") {
                        BusyIndicator.hide();
                        MessageBox.success("Deleted Succesfully");
                        sap.m.MessageToast.show("Attachement list loaded.");
                    } else if (sCallFrom == "ReadForDialog") {
                        sap.m.MessageToast.show("Attachement list loaded.");
                    } else if (sCallFrom == "InitiatorGet") {
                        sap.m.MessageToast.show("Attachement list loaded.");
                    }
                },
                error: function (oError) {
                    console.log(oError);
                    if (sCallFrom == "I") {
                        BusyIndicator.hide();
                    }
                    sap.m.MessageToast.show("Something went wrong while getting attachement data.");
                }
            });
        },
        onPressDownloadFile: function (oEvent) {
            var that = this;
            var NmNumber = oEvent.getSource().getBindingContext("jsonAttachmentListModel").getObject().NmNumber;
            var Value = oEvent.getSource().getBindingContext("jsonAttachmentListModel").getObject().Value;
            var FileName = oEvent.getSource().getBindingContext("jsonAttachmentListModel").getObject().FileName;
            var Filetype = oEvent.getSource().getBindingContext("jsonAttachmentListModel").getObject().Filetype;

            // var selectedResult = oEvent.getSource().getBindingContext("filetabmodel").getObject();
            // if (selectedResult) {
            var base64String = Value;
            var base64WithoutPrefix = base64String.includes(",") ? base64String.split(",")[1] : base64String;

            var byteCharacters = atob(base64WithoutPrefix);
            var byteNumbers = new Array(byteCharacters.length);
            for (var i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            var byteArray = new Uint8Array(byteNumbers);
            var blob = new Blob([byteArray], {
                type: Filetype
            });

            // Create Blob URL
            var url = URL.createObjectURL(blob);
            console.log("Blob URL:", url);

            // Show Image in Browser
            // document.getElementById("previewImage").src = url;

            // Create Download Link
            var link = document.createElement("a");
            link.href = url;
            link.download = FileName; // Ensure correct extension
            document.body.appendChild(link);
            link.click(); 
            document.body.removeChild(link);
            // }
        },
        onPressDRClear: function () {
            // Clear model data
            this.getView().getModel("jsonNMSummaryModel").setData(null);

            // Determine which DateRangeSelection to clear based on device
            const bIsPhone = sap.ui.Device.system.phone;
            const sDateRangeId = bIsPhone ? "idDRMobile" : "idDR";

            // Clear the DateRangeSelection value
            this.getView().byId(sDateRangeId).setValue("");

            // Optionally return
            return;

        },
        onFilterCQASummaryList: function (oEvent) {
            let sQuery = oEvent.getParameter("newValue");
            if (sQuery != "") {
                let oFilter = new sap.ui.model.Filter({
                    filters: [
                        new Filter("NmNumber", sap.ui.model.FilterOperator.Contains, sQuery),
                        new Filter("Status", sap.ui.model.FilterOperator.Contains, sQuery),
                        new Filter("Plant", sap.ui.model.FilterOperator.Contains, sQuery),
                        new Filter("Material", sap.ui.model.FilterOperator.Contains, sQuery),
                        new Filter("Sku", sap.ui.model.FilterOperator.Contains, sQuery),
                        new Filter("Line", sap.ui.model.FilterOperator.Contains, sQuery),
                        new Filter("Status", sap.ui.model.FilterOperator.Contains, sQuery),
                        // new Filter("InitiationDate", sap.ui.model.FilterOperator.Contains, sQuery),
                    ],
                    and: false
                });


                var oTable = this.getView().byId("summarytableid");
                oTable.getBinding("items").filter(oFilter, "Application");
            }
        },
        onPressClearNmSummary: function () {
            // 1. Clear the SearchField value dynamically
            var oSearchField = sap.ui.Device.system.phone
                ? this.getView().byId("idSearchInitMobile")
                : this.getView().byId("idSearchInit");
            oSearchField.setValue("");

            // 2. Clear any filters on your table binding
            var oTable = this.getView().byId("summarytableid");
            // Passing null or an empty array will remove all filters
            oTable.getBinding("items").filter(null, "Application");
        },
        resetCentralModel: function () {
            let oDefaultData = {
                FormData: {
                    NmNumber: "",
                    Plant: "",
                    Material: "",
                    MatDes: "",
                    Sku: "",
                    NmDate: "",
                    VesselName: "",
                    Line: "",
                    QuanScrapped: "",
                    NmDetHeading: "",
                    NmDetBrief: "",
                    ProbableRisk: "",
                    AffectedArea: "",
                    RootCause: "",
                    Quantity: "",
                    DisposalWay: "",
                    Cost: ""
                },
                CAPAList: [],
                CorrectiveList: [],
                PreventiveList: [],
                VisibleCapaList: [],
                SelectedCapaType: "C"
            };

            let oJsonCentralModel = this.getView().getModel("jsonCentralModel");
            oJsonCentralModel.setProperty("/Data", oDefaultData);
            let oAttachmentModel = this.getView().getModel("jsonAttachmentListModel");
            oAttachmentModel.setData({});

        },

        onPressClear: function () {
            this.resetCentralModel();
            let oJsonCentralModel = this.getView().getModel("jsonCentralModel");


            oJsonCentralModel.setProperty("/Editable/All", true);
            oJsonCentralModel.setProperty("/Editable/Material", true);
            oJsonCentralModel.setProperty("/Editable/Plant", true);
            oJsonCentralModel.setProperty("/Editable/NmDate", true);
            oJsonCentralModel.setProperty("/Editable/Plant", true);
            oJsonCentralModel.setProperty("/Editable/Line", true);
            oJsonCentralModel.setProperty("/Editable/Plant", true);
            oJsonCentralModel.setProperty("/Editable/QuanScrapped", true);
            oJsonCentralModel.setProperty("/Editable/NmDetHeading", true);
            oJsonCentralModel.setProperty("/Editable/NmDetBrief", true);
            oJsonCentralModel.setProperty("/Editable/ProbableRisk", true);
            oJsonCentralModel.setProperty("/Editable/AffectedArea", true);
            oJsonCentralModel.setProperty("/Editable/RootCause", true);
            oJsonCentralModel.setProperty("/Editable/Quantity", true);
            oJsonCentralModel.setProperty("/Editable/DisposalWay", true);
            oJsonCentralModel.setProperty("/Editable/Cost", true);
            oJsonCentralModel.setProperty("/Editable/Actionv", true);
            oJsonCentralModel.setProperty("/Editable/Responsibility", true);
            oJsonCentralModel.setProperty("/Editable/TargetDate", true);
            oJsonCentralModel.setProperty("/Editable/Status", true);
            oJsonCentralModel.setProperty("/Editable/NmNumber", false);

            oJsonCentralModel.setProperty("/Visible/InitiatorDeleteBtn", false);
            oJsonCentralModel.setProperty("/Visible/InitiatorInitiateBtn", false);
            oJsonCentralModel.setProperty("/Visible/InitiatorSaveBtn", true);
            oJsonCentralModel.setProperty("/Visible/InitiatorSaveBtn", true);
            oJsonCentralModel.setProperty("/Visible/AddLineItem", true);
            oJsonCentralModel.setProperty("/Visible/printBtn", false);
            oJsonCentralModel.setProperty("/Visible/ShowAttachFrag", false);



            oJsonCentralModel.refresh();

            var oModel = this.getView().getModel("jsonItemListModel");
            if (oModel) {
                oModel.setData(null);
                oModel.refresh();
            }


            // this.getView().getModel("jsonAttachmentListModel").setData(null);
            // this.getView().getModel("jsonAttachmentListModel").refresh();
        },
        onPressDeleteItem: function (oEvent) {
            let oJsonCentralModel = this.getView().getModel("jsonCentralModel");
            const TempData = JSON.parse(oJsonCentralModel.getJSON());
            const ChecklistNumber = TempData?.Data?.FormData?.ChecklistNumber;

            var that = this;
            // const sPath = oEvent.oSource.oParent.oBindingContexts.jsonIncidentSummaryModel.sPath;
            // let oData = this.getView().getModel("jsonIncidentSummaryModel").getProperty(sPath);
            // const IncidentNo = oData?.IncidentNo;

            const oDataModel = that.getOwnerComponent().getModel();
            BusyIndicator.show();
            oDataModel.remove("/CRUDSet('" + ChecklistNumber + "')", {
                success: function (oSucess) {
                    BusyIndicator.hide();
                    MessageBox.success(
                        "Deleted successfully", {
                        styleClass: !!that.getView().$().closest(".sapUiSizeCompact").length ? "sapUiSizeCompact" : "",
                        onClose: function () {
                            that.onPressClear();
                            that.onPressDRSearch();
                            location.reload();
                        }
                    });
                    oJsonCentralModel.setProperty("/Visible/InitiatorDeleteBtn", false);
                    oJsonCentralModel.setProperty("/Visible/InitiatorInitiateBtn", false);
                    oJsonCentralModel.setProperty("/Visible/InitiatorSaveBtn", false);
                },
                error: function (oError) {
                    console.log(oError);
                    BusyIndicator.hide();
                    sap.m.MessageToast.show("Something went wrong while deleting.");
                }
            });

        },
        onGoToReport: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);

            // var oModel = this.getView().getModel("jsonCentralModel");
            // var sNm = oModel.getProperty("/Data/FormData/NmNumber");
            // debugger;

            // if (!sNm) {
            //     sap.m.MessageToast.show("NM Number not found");
            //     return;
            // }

            // sNm = encodeURIComponent(sNm);

            oRouter.navTo("RouteReport");
        },
        onPressPrint: function () {
            var that = this;

            that._printForm();
        },

        _printForm: function (withTheoreticalValue) {
            var that = this;

            var oModel = that.getView().getModel();
            var oJsonCentralModel = that.getView().getModel("jsonCentralModel");
            var NmNumber = oJsonCentralModel.getProperty("/Data/FormData/NmNumber");

            var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
            BusyIndicator.show();

            // You can add logic here to modify TrfNo or Action based on withTheoreticalValue if needed.

            var sEncodedNm = encodeURIComponent(NmNumber);

            var sPath = "/NMADOBESet(NmNumber='" + sEncodedNm + "')";

            oModel.read(sPath, {
                success: function (oSuccess) {
                    BusyIndicator.hide();

                    var test2 = atob(oSuccess.Value);
                    var byteNumbers = new Array(test2.length);
                    for (var i = 0; i < test2.length; i++) {
                        byteNumbers[i] = test2.charCodeAt(i);
                    }

                    var byteArray = new Uint8Array(byteNumbers);
                    var blob = new Blob([byteArray], {
                        type: 'application/pdf'
                    });

                    var url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                },
                error: function (oError) {
                    BusyIndicator.hide();
                }
            });
        },

        onStatusChange: function () {
            var oJsonCentralModel = this.getView().getModel("jsonCentralModel");
            oJsonCentralModel.setProperty("/Visible/InitiatorInitiateBtn", false);
            this._checkFinalSubmissionStatus();

        }
    });
});
