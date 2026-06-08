// Level Up Playbook — MFP Financial Data (from Procore Commitments, contract docs, and CMA)
// Updated June 8, 2026 — including soft costs from budget files and design consultant log
// Hard Costs — 24 subcontractors, 25 contracts from Procore
// Soft Costs — from MFP Master Design Consultant Log, FF&E Budget, Construction Budget

window.__MFP_FINANCIALS = {
  hard: {
    total_original: 484725419.99,
    total_approved_cos: 45301139.00,
    total_revised: 530026558.99,
    total_pending_cos: 4868713.98,
    total_invoiced: 459357694.50,
    total_paid: 412731063.00,
    total_pct_paid: 77.87,
    total_balance: 117295495.99,
    co_volume_total: 505234546.35,
    // 24 subcontractors, 25 contracts
    commitments: [
      {company:"QUALICO STEEL CO., INC.",title:"Structural Steel",contract:"19069-SC-001",orig:12754688.00,co:3789983.12,revised:16544671.12,invoiced:16544671.12,paid:16309671.12,pct_paid:98.58,balance:235000.00},
      {company:"Metromont LLC",title:"Precast_Metromont",contract:"19069-SC-002",orig:13296238.00,co:3440069.26,revised:16736307.26,invoiced:15072447.79,paid:15072448.28,pct_paid:90.06,balance:1663858.98},
      {company:"BAKER CONCRETE CONSTRUCTION INC.",title:"Cast-in-Place Concrete",contract:"19069-SC-003",orig:51490000.00,co:10309815.07,revised:61799815.07,invoiced:59119998.88,paid:57071802.07,pct_paid:92.35,balance:4728013.00},
      {company:"RIGHT WAY PLUMBING & MECHANICAL LLC",title:"Underground Plumbing",contract:"19069-SC-004",orig:19889328.00,co:299971.77,revised:20189299.77,invoiced:19179835.11,paid:15093373.49,pct_paid:74.76,balance:5095926.28},
      {company:"O&R CONSTRUCTION SERVICES LLC",title:"Masonry",contract:"19069-SC-005",orig:9412636.37,co:-870987.05,revised:8541649.32,invoiced:8541649.32,paid:7622461.81,pct_paid:89.24,balance:919187.51},
      {company:"ALPHACLADDING LLC",title:"Glazing and Glass Railing",contract:"19069-SC-006",orig:8480945.68,co:1370701.81,revised:9851647.49,invoiced:9335360.34,paid:6496219.84,pct_paid:65.94,balance:3355427.65},
      {company:"TK ELEVATOR CORPORATION",title:"Elevators",contract:"19069-SC-007",orig:3707729.03,co:874321.07,revised:4582050.10,invoiced:4121886.57,paid:3628929.65,pct_paid:79.20,balance:953120.45},
      {company:"SPRINKLERMATIC FIRE PROTECTION SYSTEMS, INC.",title:"Fire Suppression",contract:"19069-SC-008",orig:2317180.00,co:454716.00,revised:2771896.00,invoiced:2494706.39,paid:2005410.60,pct_paid:72.35,balance:766485.40},
      {company:"MILLER ELECTRIC COMPANY",title:"Electrical",contract:"19069-SC-009",orig:76286182.00,co:8614132.75,revised:84900314.75,invoiced:76859167.34,paid:66494694.10,pct_paid:78.32,balance:18405620.65},
      {company:"Alliance Verdi USA, LLC d/b/a Alliance USA",title:"EIFS-Stucco",contract:"19069-SC-010",orig:2855120.00,co:861558.70,revised:3716678.70,invoiced:3283651.58,paid:2844528.47,pct_paid:76.53,balance:872150.23},
      {company:"S&R Enterprises Steel LLC",title:"Canopy Superstructure - Steel Erection",contract:"19069-SC-011",orig:6945600.00,co:3413885.69,revised:10359485.69,invoiced:9285832.77,paid:7813411.22,pct_paid:75.42,balance:2546074.47},
      {company:"DECKTIGHT ROOFING SERVICES, INC. (D)",title:"Roofing",contract:"19069-SC-012",orig:3739640.28,co:133234.38,revised:3872874.66,invoiced:3143237.53,paid:2862285.13,pct_paid:73.91,balance:1010589.53},
      {company:"GEORGE'S WELDING SERVICES, INC.",title:"Misc Metals",contract:"19069-SC-013",orig:4650000.00,co:-246167.11,revised:4403832.89,invoiced:3923624.53,paid:1865271.96,pct_paid:42.36,balance:2538560.93},
      {company:"Modern Heavy Industries",title:"Roof Canopy Structural Steel",contract:"19069-SC-014",orig:9585352.00,co:1790960.89,revised:11376312.89,invoiced:11376312.89,paid:10238681.61,pct_paid:90.00,balance:1137631.28},
      {company:"ENCLOS TENSILE STRUCTURES, INC.",title:"Canopy Steel",contract:"19069-PO-001",orig:32035629.00,co:-32035629.00,revised:0.00,invoiced:0.00,paid:0.00,pct_paid:0.00,balance:0.00},
      {company:"WORLD ELECTRIC SUPPLY, INC.",title:"Switchgears",contract:"19069-PO-002",orig:1653104.12,co:266486.02,revised:1919590.14,invoiced:1887584.67,paid:1859686.67,pct_paid:96.88,balance:59903.47},
      {company:"G-FORCE WATERPROOFING & RESTORATION, LLC",title:"Waterproofing",contract:"19069-PO-003",orig:498126.60,co:84948.45,revised:583075.05,invoiced:583075.05,paid:499832.99,pct_paid:85.72,balance:83242.06},
      {company:"GEORGE'S WELDING SERVICES, INC.",title:"Canopy Anchor Bolt Templates",contract:"19069-PO-004",orig:29930.00,co:52132.00,revised:82062.00,invoiced:82062.00,paid:82062.00,pct_paid:100.00,balance:0.00},
      {company:"ATLANTIC DOORS & HARDWARE, INC.",title:"Doors and Hardware",contract:"19069-PO-005",orig:15859.54,co:0.00,revised:15859.54,invoiced:15859.54,paid:15859.54,pct_paid:100.00,balance:0.00},
      {company:"R.J. Watson, Inc.",title:"High Load Multirotational Disc Bearings",contract:"19069-PO-006",orig:456856.12,co:61098.00,revised:517954.12,invoiced:517954.12,paid:517953.40,pct_paid:100.00,balance:0.72},
      {company:"GENSERVE LLC",title:"Emergency Generator",contract:"19069-PO-007",orig:1436212.85,co:-65770.50,revised:1370442.35,invoiced:1323463.42,paid:1323463.42,pct_paid:96.57,balance:46978.93},
      {company:"PROFESSIONAL SERVICE INDUSTRIES, INC.",title:"Geotechnical Engineering",contract:"19069-PO-008",orig:7500.00,co:15000.00,revised:22500.00,invoiced:9542.50,paid:0.00,pct_paid:0.00,balance:22500.00},
      {company:"HERRERA COMMUNICATIONS, LLC DBA FAST SIGNS",title:"Signage",contract:"19069-PO-009",orig:1074.43,co:0.00,revised:1074.43,invoiced:0.00,paid:0.00,pct_paid:0.00,balance:1074.43},
      {company:"Aicher Steel Americas",title:"Anchor Bolts",contract:"19069-PO-010",orig:289596.34,co:50311.54,revised:339907.88,invoiced:339907.88,paid:339907.88,pct_paid:100.00,balance:0.00},
      {company:"HYDROWORX INTERNATIONAL INC.",title:"Hydrotherapy Pools",contract:"19069-PO-011",orig:83766.00,co:4000.00,revised:87766.00,invoiced:83766.00,paid:83766.00,pct_paid:95.44,balance:4000.00}
    ]
  },
  soft: {
    // Soft Costs from MFP Master Design Consultant Log (Stadium only)
    design_total: 28451538.00,
    design_team: [
      {firm:"MANICA Architecture",scope:"Design Architect",fee:5389750},
      {firm:"Arquitectonica (ARQ)",scope:"Architect of Record",fee:6964543},
      {firm:"ARQ Interiors",scope:"Interior Design",fee:476025},
      {firm:"Thornton Tomassetti",scope:"Structural Engineering",fee:3452120},
      {firm:"Schlaich Bergermann Partner (SBP)",scope:"Canopy Structural Design",fee:1574400},
      {firm:"WJHW",scope:"Acoustical / Low Voltage / Communications",fee:3452120},
      {firm:"Smith Seckman Reid (SSR)",scope:"MEP Engineering",fee:2501594},
      {firm:"Kimley-Horn",scope:"Civil Engineering",fee:566500},
      {firm:"Gensler",scope:"Signage & Wayfinding",fee:1207000},
      {firm:"HLB",scope:"Specialty Lighting",fee:291583},
      {firm:"SOCOTEC / SLS",scope:"Fire & Life Safety / Accessibility",fee:407500},
      {firm:"SOCOTEC / SLS",scope:"LEED Certification",fee:237006},
      {firm:"Duray",scope:"Food & Beverage Consulting",fee:168400},
      {firm:"Millennium",scope:"Field Design",fee:140000},
      {firm:"BCNO.3",scope:"Project Manual",fee:135000},
      {firm:"Persohn/Hahn",scope:"Vertical Transportation",fee:58775},
      {firm:"Divergent Thinkers",scope:"BIM + 4D Modeling",fee:372000},
      {firm:"Cini-Little",scope:"Waste Management Consulting",fee:29225},
      {firm:"Pacifica",scope:"Material Testing & Inspection",fee:318829},
      {firm:"Smith-Emery",scope:"Steel Testing & Inspection",fee:417083},
      {firm:"ViewPointe Consulting",scope:"Permit Expediting",fee:188835},
      {firm:"BNI",scope:"Structural Peer Review",fee:48000},
      {firm:"Studio08",scope:"Door Hardware Consulting",fee:55250}
    ],
    // FF&E Budget (from Llinx portal — 1,831 orders, excl. DreamSeats)
    ffe_budget: 15767602,
    ffe_source: "llinx_export_20260608",
    ffe_breakdown: [
      {category:"Grounds & Field Equipment",amount:4259412, detail:"159 items — grow lights, turf equipment"},
      {category:"Portable Carts & OS&E",amount:2258454, detail:"30-Carts $1.2M / 31-OS&E $208K / 32-OS&E2 $878K"},
      {category:"FF&E (ARQ Designed)",amount:2139469, detail:"159 items — planters, barstools, fixtures"},
      {category:"Technology & POS",amount:1924535, detail:"82-Comm $424K / 83-POS $724K / 86-BoxOffice $777K"},
      {category:"Building Operations",amount:922013, detail:"20-Ops $87K / 21-Waste $529K / 22-Vehicles $263K / 23-Storage $42K"},
      {category:"Installation",amount:861257, detail:"54 items — on-site PM, labor"},
      {category:"Team Spaces & Sports Equipment",amount:817944, detail:"70-Team $236K / 72-Sports $582K"},
      {category:"Warehousing & Freight",amount:769984, detail:"95-Warehouse $444K / 99-SeatFreight $326K"},
      {category:"Security Equipment",amount:650943, detail:"41 items — X-ray, screening"},
      {category:"Concourse Furniture",amount:440630, detail:"19 items — tables, dining sets"},
      {category:"Appliances",amount:305171, detail:"23 items — fridges, microwaves"},
      {category:"Platforms & Staging",amount:296366, detail:"Field stairs, pitchside seating"},
      {category:"FFE Samples & Attic Stock",amount:90605, detail:"1-Samples $21K / 64-Attic $70K"},
      {category:"Broadcast & Event Ops",amount:30819, detail:"3 items — mannequins, allowance"}
    ],
    // Additional soft costs from Budget files
    freight: 16112254,       // From Contract Summary May 23 2026 - FRACHT vendor ($16,112,254 total via COs, $14,917,048 paid)
    customs_duties: 13989138, // From Contract Summary May 23 2026 - U.S. Customs vendor ($13,989,138 total via COs, fully paid)
    contingency: 15500000,
    owner_rep: null,        // Level Up fee — confidential
    legal: null,            // Not found in files yet
    ocip: null,             // Not found in files yet
    commissioning: null,    // Not found in files yet
    permits: 188835,        // Included in design_team (ViewPointe)
    note: "Design team fees from Master Consultant Log (Stadium only). Other soft costs (OCIP, legal, owner's rep, commissioning) not yet sourced from files"
  },
  // Project context summary from mfp_context.js and contract extraction
  summary: {
    total_budget: 824199990,
    budget_at_closing: 710953041,
    realized_changes: 93987589,
    paid_to_date: 412731063,
    incurred_to_date: 440414875,
    past_due: 11779630,
    stadium_base_contract: 530448817,
    stadium_pct_complete: 94.2,
    approved_cos_total: 45301139,
    lemartec_indirects_outstanding: 39639976,
    retainage_held: 25454318,
    days_past_baseline: 153,
    target_completion: "July 31, 2026",
    home_opener: "April 4, 2026"
  }
};