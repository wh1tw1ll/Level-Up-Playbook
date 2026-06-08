// Level Up Playbook — MFP Financial Data (from Procore Commitments, contract docs, and CMA)
// Updated June 8, 2026 — based on Procore sync and contract document extraction
// Hard Costs — 24 subcontractors, 25 contracts
// Soft Costs — TBD from budget docs (pending file access)
// Design Team — TBD from budget docs (ARQ, MANICA, engineers)

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
    co_volume_total: 505234546.35,  // Total volume including COs
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
    // PENDING: Will populate from budget docs once file access granted
    note: "Soft costs to be added from budget/accounting documents — expected to include design fees (ARQ, MANICA, engineers), permits, OCIP, testing, commissioning, legal, owner's rep",
    design_team: [],
    permits: null,
    testing: null,
    commissioning: null,
    ocip: null,
    legal: null,
    owner_rep: null
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