sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet",
],
    function (Controller, BusyIndicator, MessageBox, Filter, FilterOperator, Spreadsheet) {
        "use strict";

        return Controller.extend("com.emami.nearmiss.controller.Report", {
            onInit: function () {

                // Load jsonCentralModel from external JSON file
                var oJsonModel = new sap.ui.model.json.JSONModel();
                oJsonModel.loadData("model/jsonCentralModel.json"); // adjust path if needed
                this.getView().setModel(oJsonModel, "jsonCentralModel");

                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.getRoute("RouteReport").attachPatternMatched(this._onObjectMatched, this);
            },

            _onObjectMatched: function (oEvent) {
                let that = this;
                var sNm = oEvent.getParameter("arguments").nm;
                sNm = decodeURIComponent(sNm);

                // use NM number
                console.log("NM Number:", sNm);
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

                // this.byId('idInputWipCode').setValue(Matnr);
                // this.byId('idInputUnitCode').setValue(Werks);
                let oJsonCentralModel = this.getView().getModel("jsonCentralModel");
                debugger;
                oJsonCentralModel.setProperty("/Data/ReportData/Plant", Plant);
                oJsonCentralModel.refresh();

            },
            onSearch: function () {
                var that = this;
                var oDataModel = this.getView().getModel(); // OData model
                var jsonReportListModel = this.getView().getModel("jsonReportListModel");

                var aFilters = [];

                // Read values from UI
                var sPlant = this.byId("idInputPlant1").getValue();
                var sYear = this.byId("cbYear").getSelectedKey();
                var sRisk = this.byId("idProbableRisk1").getSelectedKey();
                var sCapa = this.byId("cbCapa").getSelectedKey();

                // Build filters
                if (sPlant) {
                    aFilters.push(new sap.ui.model.Filter("Plant", sap.ui.model.FilterOperator.EQ, sPlant));
                }
                if (sYear) {
                    aFilters.push(new sap.ui.model.Filter("YearTime", sap.ui.model.FilterOperator.EQ, sYear));
                }
                if (sRisk) {
                    aFilters.push(new sap.ui.model.Filter("ProbableRisk", sap.ui.model.FilterOperator.EQ, sRisk));
                }
                if (sCapa) {
                    aFilters.push(new sap.ui.model.Filter("CapaStatus", sap.ui.model.FilterOperator.EQ, sCapa));
                }

                sap.ui.core.BusyIndicator.show();
                debugger;

                oDataModel.read("/NMREPORTSet", {
                    filters: aFilters,
                    success: function (oData) {
                        sap.ui.core.BusyIndicator.hide();
                        jsonReportListModel.setData(oData.results);
                    },
                    error: function () {
                        sap.ui.core.BusyIndicator.hide();
                        sap.m.MessageToast.show("Error while fetching data");
                    }
                });
            },
            onPrepareExportReportModel: function () {
    // Get report list model
    var oModel = this.getView().getModel("jsonReportListModel");
    var aData = oModel.getData() || [];

    // Clone data to avoid mutating table model
    var oExportModel = new sap.ui.model.json.JSONModel(JSON.parse(JSON.stringify(aData)));
    this.getView().setModel(oExportModel, "jsonExportReportModel");
},

onExport: function () {
    try {
        // Prepare export model
        this.onPrepareExportReportModel();

        var oModel = this.getView().getModel("jsonExportReportModel");
        var aData = oModel.getData();

        if (!aData || aData.length === 0) {
            sap.m.MessageToast.show("No data available to export.");
            return;
        }
//         debugger;

//        const formatDate = (dateObj) => {
//                         if (!dateObj || !(dateObj instanceof Date)) return "";

//                         let dd = String(dateObj.getDate()).padStart(2, "0");
//                         let mm = String(dateObj.getMonth() + 1).padStart(2, "0");
//                         let yyyy = dateObj.getFullYear();

//                         return `${dd}-${mm}-${yyyy}`;
//                     };

//                     aData.forEach(item => {
//                         if (item.NmDate) {
//                             item.NmDate = formatDate(item.NmDate);
//                         }
//                     });
// debugger;

        oModel.setData(aData);
        oModel.refresh(true);

        // Dynamic file name (Plant + Year)
        var sPlant = aData[0].Plant || "ALL";
        var sYear = aData[0].YearTime || "ALL";
        var sFileName = "Near_Miss_Report_" + sPlant + "_" + sYear + ".xlsx";

        var oExport = new sap.ui.export.Spreadsheet({
            workbook: {
                columns: [
                    { label: "NM Number", property: "NmNumber" },
                    { label: "Unit", property: "Plant" },
                    { label: "Date of Near Miss",
                        property: "NmDate",
                        type: sap.ui.export.EdmType.Date,
                        formatOptions: {
                            pattern: "dd/MM/yyyy"
                        }
            },
                    { label: "Product / Area", property: "Material" },
                    { label: "SKU", property: "Sku" },
                    { label: "NM Details", property: "NmDetHeading" },
                    { label: "Probable Risk", property: "ProbableRisk" },
                    { label: "Quantity", property: "Quantity" },
                    { label: "Root Cause", property: "RootCause" },
                    { label: "Corrective Action", property: "CorrectiveAction" },
                    { label: "Preventive Action", property: "PreventiveAction" },
                    { label: "CAPA Status", property: "CapaStatus" }
                ]
            },
            dataSource: aData,
            fileName: sFileName,
            worker: false
        });

        oExport.build()
            .then(function () {
                sap.m.MessageToast.show("Export completed successfully!");
            })
            .catch(function (oError) {
                sap.m.MessageBox.error("Export failed: " + oError.message);
            })
            .finally(function () {
                oExport.destroy();
            });

    } catch (e) {
        sap.m.MessageBox.error("Error during export: " + e.message);
    }
}

        });
    });
