"use strict";

const law = (name, note, source) => ({ name, status: "postwar", note, source });
const nucc = "https://crphmyanmar.org/wp-content/uploads/2021/04/Federal-Democracy-Charter-English.pdf#page=5";
const yemen = "https://faolex.fao.org/docs/pdf/yem201248E.pdf#page=20";
const arakanJustice = "https://www.arakanstudies.org/ibr/24/04/ibr_04-Oct_24.html";
const arakanGovernment = "https://mmpeacemonitor.org/en/en-news/aa-bolsters-civil-service-to-rebuild-arakan-state/";
const stc = "https://efile.fara.gov/docs/7596-Exhibit-AB-20250521-1.pdf";
const daanes = "https://rojavainformationcenter.org/storage/2023/12/Social-Contract-English-Final.pdf";
const dohacongo = "https://au.int/sites/default/files/documents/45656-doc-2025.11.15_-_SIGNED_Framework_Peace_Agreement_EN.pdf";

module.exports = {
  "ucdp-state-411": { "ucdp-actor-169": {
    scope: "national", countryKey: "608", title: "Philippine People’s Democratic Republic",
    administration: "People’s Democratic Coalition Government", regime: "revolutionary_coalition", partyTag: "CPP",
    government: "A CPP-led provisional coalition, based on the published national democratic program.",
    laws: { land_tenure: "redistribution", regime_propriete: "expropriation_allowed" },
    regionalLaws: [law("Agrarian reform", "PPO maps the published land reform program to land redistribution and expropriation powers. The full state title is a scenario formulation of the movement’s proposed republic.", "https://ndfp.info/article-iv/")],
  } },
  "ucdp-state-453": { "ucdp-actor-195": {
    scope: "national", countryKey: "356", title: "People’s Democratic Republic of India",
    administration: "People’s Democratic Government", regime: "revolutionary_coalition", partyTag: "CPI-Maoist",
    government: "A Maoist-led provisional revolutionary coalition with a program of agrarian reform.",
    laws: { land_tenure: "redistribution", regime_propriete: "expropriation_allowed" },
    regionalLaws: [law("Agrarian redistribution", "PPO maps the published program to land redistribution and expropriation. The state title is a scenario formulation.", "https://www.satp.org/satporgtp/countries/india/maoist/documents/papers/partyprogram.htm")],
  } },
  "ucdp-state-14595": { "ucdp-actor-123": {
    scope: "national", countryKey: "887", regime: "islamic_republic", partyName: "Ansar Allah", partyTag: "AA",
    laws: { religion_state: 3, freedom_of_worship: 1, religion_in_education: 5, media_freedom: { press: "muzzled", internet: "censored" } },
    regionalLaws: [
      law("Islamic legal framework", "The postwar scenario keeps Islamic law and religious instruction at the center of government.", yemen),
      law("Restrictions on religious and civic life", "PPO models restrictive religious and information policy under the new executive.", "https://www.uscirf.gov/sites/default/files/2025-08/2025%20Factsheet%20Houthi.pdf"),
    ],
  } },
  "myanmar-post-coup-war": { "mmr-nug": {
    scope: "national", countryKey: "104", administration: "National Unity Government", regime: "federal_parliamentary", partyTag: "NUG",
    laws: { religion_state: 0, freedom_of_worship: 4, military_service: { mode: "volunteer", months: 0 }, media_freedom: { press: "free", internet: "open" } },
    regionalLaws: [law("Federal Democracy Charter", "The winning coalition installs a civilian federal executive and bicameral parliament under a secular framework. Ending the junta’s conscription is a scenario transition choice.", nucc)],
  }, "mmr-sspc": {
    scope: "national", countryKey: "104", title: "Republic of the Union of Myanmar", incumbent: true,
    administration: "State Security and Peace Commission", regime: "military_directorate", partyTag: "SSPC",
    government: "The military-led Union Government remains in office under the commission’s oversight.",
    laws: { military_service: { mode: "conscription", months: 24 } },
    regionalLaws: [
      law("Military-led interim government", "The existing commission maintains military control. The 2008 constitution reserved seats for military appointees when parliament sat.", "https://www.wipo.int/wipolex/en/text/496926"),
      law("Regional martial law", "Martial law applies to designated townships. This entry records that limited jurisdiction on the stock map.", "https://bangkok.ohchr.org/sites/default/files/documents/2025-12/OHCHRMyanmar-Background-paper-on-military-elections-Nov25.pdf"),
    ],
  } },
  "myanmar-arakan-conflict": { "mmr-aa": {
    scope: "autonomy", countryKey: "104", regionKeys: ["MMR-3273"], regime: "regional_council", partyName: "United League of Arakan",
    partyTag: "ULA", mixed: true, laws: { free_public_education: "primary" },
    regionalLaws: [
      law("Regional courts and appeals", "The regional authority administers its own local courts and appeals. National sovereignty stays with Myanmar.", arakanJustice),
      law("Regional civil service", "The Arakkha administration runs local government departments and appoints civil servants.", arakanGovernment),
      law("Basic public schooling", "PPO models support at the primary level. Wartime provision and fees varied by locality, and the scenario does not guarantee universal access.", "https://dmediag.com/news/isikt.html"),
    ],
  } },
  "ucdp-nonstate-15915": { "ucdp-actor-7344": {
    scope: "independence", countryKey: "887", regionKeys: ["YEM-3497", "YEM-332", "YEM-336", "YEM-3510", "YEM-3511"],
    administration: "Southern Transitional Council", regime: "federal_parliamentary", partyTag: "STC",
    regionalLaws: [law("Southern National Charter", "The new government follows the federal southern-state proposal. Its borders in PPO are bounded by the stock provinces in this settlement.", stc)],
  } },
  "ucdp-state-17666": { "ucdp-actor-8822": {
    scope: "independence", countryKey: "466", regionKeys: ["MLI-2688", "MLI-2689", "MLI-2690"],
    administration: "Government of Azawad", regime: "provisional_council", partyTag: "FLA",
    regionalLaws: [law("Azawad founding pact", "The transitional executive represents the coalition formed by the 2024 pact. The pact calls for liberation and an Azawad government. The long-term constitution is unsettled.", "https://www.peaceagreements.org/agreements/2696/")],
  } },
  "ucdp-state-14636": { "ucdp-actor-6287": {
    scope: "independence", countryKey: "566", regionKeys: ["NGA-2857"], regime: "provisional_council", partyTag: "IPOB",
    regionalLaws: [law("Provisional restoration government", "PPO uses a transitional executive for the independence claim in the southeast. The 1967 proclamation supplies the state title.", "https://www.historians.org/resource/biafran-declaration-of-independence/")],
  } },
  "ucdp-state-15895": { "ucdp-actor-7332": {
    scope: "independence", countryKey: "120", regionKeys: ["CMR-1477", "CMR-799"],
    administration: "Ambazonian Interim Government", regime: "federal_parliamentary", partyTag: "AIG",
    regionalLaws: [law("Ambazonian interim constitution", "PPO applies the published federal interim framework as the successful political settlement between the participating separatist commands.", "https://ambazoniagov.org/images/docs/Interim-Constitution-of-the-Federal-Republic-ofAmbazonia.pdf")],
  } },
  "ucdp-state-16177": { "ucdp-actor-7542": {
    scope: "independence", countryKey: "586", regionKeys: ["PAK-1108"], regime: "provisional_council", partyTag: "BRAS", coexistingFrontIds: ["ucdp-state-857", "ucdp-state-14319"], mixed: true,
    regionalLaws: [law("Baloch provisional administration", "PPO uses an interim coalition government pending a constitutional agreement. The wider movement’s charter is evidence of a political program, while BRAS contains distinct commands.", "https://balochistanliberationcharter.com/index.php/english/")],
  } },
  "ucdp-state-628": { "ucdp-actor-266": {
    scope: "independence", countryKey: "360", regionKeys: ["IDN-558"], regime: "provisional_council", partyTag: "OPM",
    regionalLaws: [law("West Papuan provisional administration", "The 1971 proclamation supplies the title. PPO models an interim government under the winning movement while the long-term institutions remain open.", "https://www.papua-merdeka.org/post/copy-of-opm-media-statement-in-the-port-moresby-press-conference")],
  } },
  "warwatch-3103": { "warwatch-actor-3096": {
    scope: "independence", countryKey: "686", regionKeys: ["SEN-775", "SEN-5514", "SEN-774"],
    regime: "provisional_council", partyTag: "MFDC",
    regionalLaws: [law("Casamance provisional administration", "PPO gives the independence claimant an interim government. The other MFDC faction retains its own ceasefire record.", "https://warwatch.ch/situations/non-international-armed-conflict-in-senegal/?tab=tab-2")],
  } },
  "warwatch-3244": { "warwatch-actor-3242": {
    scope: "independence", countryKey: "504", regionOwnerKeys: ["504", "732"], regionKeys: ["SAH+00?"], regionLabels: { "SAH+00?": "Western Sahara" },
    regime: "parliamentary_republic", regionalOnly: true, mixed: true,
    administration: "Government of the Sahrawi Arab Democratic Republic",
    regionalLaws: [law("Sahrawi constitutional institutions", "The postwar record recognizes the existing declared Sahrawi government as the administering authority. The stock province combines disputed territory and cannot allocate the claims separately.", "https://au.int/en/member_states/countryprofiles2")],
  } },
  "ucdp-state-477": { "ucdp-actor-209": {
    scope: "autonomy", countryKey: "275", regionKeys: ["GAZ+00?"], regionLabels: { "GAZ+00?": "Gaza Strip" },
    regionalOnly: true, mixed: true, administration: "Gaza civil administration", regime: "regional_council",
    regionalLaws: [law("Local civil administration in Gaza", "The victory outcome applies to Gaza. The 2017 program does not establish a new Palestinian constitutional title or authorize changing the West Bank administration.", "https://translations.meforum.org/documents/hamas-2017/")],
  } },
  "ucdp-state-14784": { "ucdp-actor-6288": {
    scope: "autonomy", countryKey: "760", regionKeys: ["SYR-141", "SYR-136"],
    title: "Democratic Autonomous Administration of North and East Syria", administration: "Democratic Autonomous Administration of North and East Syria",
    partyName: "Democratic Autonomous Administration of North and East Syria", partyTag: "DAANES",
    regime: "regional_council", regionalOnly: true, mixed: true,
    regionalLaws: [law("Social Contract of North and East Syria", "The regional administration uses its council and co-chair system and recognizes Arabic, Kurdish and Syriac. Mixed stock provinces remain marked accordingly.", daanes)],
  } },
  "ucdp-state-17740": { "ucdp-actor-8885": {
    scope: "autonomy", countryKey: "180", regionKeys: ["COD-1898", "COD-1894"], regionalOnly: true, mixed: true,
    title: "Kivu Transitional Administration", administration: "AFC/M23 transitional administration", regime: "provisional_council",
    regionalLaws: [law("Transitional local authority", "PPO represents a bounded local political settlement in the affected parts of Kivu, with independent forces and legal status preserved elsewhere. The Doha framework provides a negotiation process.", dohacongo)],
  } },
  "ucdp-state-15993": { "ucdp-actor-7412": {
    scope: "independence", countryKey: "24", regionKeys: ["AGO-1885"], title: "State of Cabinda",
    regime: "provisional_council", partyTag: "FLEC",
    regionalLaws: [law("Cabindan provisional administration", "PPO uses an interim government for the independence claim. The African Commission record documents the claim of a State of Cabinda.", "https://achpr.au.int/sites/default/files/files/2022-11/achpr54decis32806angola2013eng.pdf")],
  } },
  "myanmar-kachin-conflict": {
    "mmr-kio": {
      "scope": "autonomy",
      "countryKey": "104",
      "title": "Kachin State",
      "administration": "Kachin Independence Organization civil administration",
      "government": "Territorial Kachin self-government",
      "regime": "regional_council",
      "regionKeys": [
        "MMR-3296"
      ],
      "regionalOnly": true,
      "mixed": true,
      "regionalLaws": [
        {
          "name": "Local public services",
          "status": "in_practice",
          "note": "KIO administers public services including local health and education.",
          "source": "https://www.iseas.edu.sg/articles-commentaries/iseas-perspective/2025-18-reinventing-territorial-self-governance-in-myanmar-kachins-new-approach-and-its-dilemma-in-post-coup-myanmar-by-su-mon-thazin-aung/"
        }
      ]
    }
  },
  "myanmar-karen-conflict": {
    "mmr-knu": {
      "scope": "autonomy",
      "countryKey": "104",
      "title": "Kawthoolei",
      "administration": "Karen National Union administration",
      "government": "Karen self-determination within a democratic federal union",
      "regime": "regional_council",
      "regionKeys": [
        "MMR-3266"
      ],
      "regionalOnly": true,
      "mixed": true,
      "regionalLaws": [
        {
          "name": "Karen National Union constitution",
          "status": "in_force",
          "note": "The amended KNU constitution governs its own administrative territory.",
          "source": "https://www.knuhq.org/policy-law"
        }
      ]
    }
  },
  "myanmar-chin-conflict": {
    "mmr-cnf": {
      "scope": "autonomy",
      "countryKey": "104",
      "title": "Chinland",
      "administration": "Chinland Council and Government",
      "government": "Federal democratic Chin self-government",
      "regime": "regional_council",
      "regionKeys": [
        "MMR-3274"
      ],
      "regionalOnly": true,
      "mixed": true,
      "regionalLaws": [
        {
          "name": "Chinland Constitution of 2023",
          "status": "in_force",
          "note": "The constitution is limited to the council's institutions and participants.",
          "source": "https://mmpeacemonitor.org/en/en-interviews/there-were-also-talks-about-a-meeting-with-these-three-groups-which-havent-able-to-participate-after-the-conference-thats-why-we-have-kept-the-door-open-for-them-to-participate/"
        }
      ]
    }
  },
  "myanmar-chin-national-defence-force-conflict": {
    "mmr-cndf": {
      "scope": "autonomy",
      "countryKey": "104",
      "title": "Falam local administration",
      "administration": "Chin National Organization",
      "government": "Separate Chin self-government and local services",
      "regime": "regional_council",
      "regionKeys": [
        "MMR-3274"
      ],
      "regionalOnly": true,
      "mixed": true,
      "regionalLaws": [
        {
          "name": "CNO-supported public schooling",
          "status": "in_practice",
          "note": "CNO education services in parts of Falam Township.",
          "source": "https://mmpeacemonitor.org/en/en-news/volunteer-teachers-recruited-for-public-schools-in-cdf-controlled-areas-in-falam/"
        }
      ]
    }
  },
  "myanmar-karenni-conflict": {
    "mmr-knpp": {
      "scope": "autonomy",
      "countryKey": "104",
      "title": "Karenni State",
      "administration": "Interim Executive Council of Karenni State",
      "government": "Shared interim authorities and consultative governance",
      "regime": "regional_council",
      "regionKeys": [
        "MMR-2473"
      ],
      "regionalOnly": true,
      "mixed": true,
      "regionalLaws": [
        {
          "name": "Interim Arrangements for Karenni State",
          "status": "in_force",
          "note": "The consultative council and interim administration share powers.",
          "source": "https://ieckarenni.org/interim-arrangements-for-karenni-state/"
        },
        {
          "name": "Karenni State Interim Taxation Policy",
          "status": "in_force",
          "note": "Enacted 6 December 2025 by the shared institutions.",
          "source": "https://ieckarenni.org/karenni-state-interim-taxation-policy/"
        },
        {
          "name": "Karenni State Interim Local Governance Policy",
          "status": "in_force",
          "note": "Enacted 6 December 2025 by the shared institutions.",
          "source": "https://ieckarenni.org/karenni-state-interim-local-governance-policy/"
        }
      ]
    }
  },
  "myanmar-kokang-ceasefire": {
    "mmr-mndaa": {
      "scope": "autonomy",
      "countryKey": "104",
      "title": "Kokang Self-Administered Region",
      "administration": "Kokang Regional Administrative Committee",
      "government": "Kokang self-government",
      "regime": "regional_council",
      "regionKeys": [
        "MMR-3277"
      ],
      "regionalOnly": true,
      "mixed": true,
      "regionalLaws": [
        {
          "name": "Kokang regional administration",
          "status": "in_practice",
          "note": "The MNTJP/MNDAA has a separate Kokang committee.",
          "source": "https://ispmyanmar.com/myanmar-national-democratic-alliance-army-mndaa-2/"
        }
      ]
    }
  },
  "myanmar-taang-ceasefire": {
    "mmr-tnla": {
      "scope": "autonomy",
      "countryKey": "104",
      "title": "Ta’ang local administration",
      "administration": "Palaung State Liberation Front administration",
      "government": "Ta’ang self-government and public services",
      "regime": "regional_council",
      "regionKeys": [
        "MMR-3277"
      ],
      "regionalOnly": true,
      "mixed": true,
      "regionalLaws": [
        {
          "name": "PSLF local administration",
          "status": "in_practice",
          "note": "Local justice, health, education and revenue departments.",
          "source": "https://ispmyanmar.com/taang-national-liberation-army-tnla/"
        }
      ]
    }
  },
  "syr-suwayda-government": {
    "syr-suwayda-local-groups": {
      "scope": "autonomy",
      "countryKey": "760",
      "title": "Suwayda local administration",
      "administration": "Supreme Legal Committee",
      "government": "Local de facto committee and public services",
      "regime": "regional_council",
      "regionKeys": [
        "SYR-143"
      ],
      "regionalOnly": true,
      "mixed": true,
      "regionalLaws": [
        {
          "name": "Local public administration",
          "status": "in_practice",
          "note": "The committee administers services; National Guard is a separate security coalition.",
          "source": "https://www.arab-reform.net/wp-content/uploads/2025/12/Security-Transformations-in-Southern-Syria-Authority-Armed-Networks-and-Foreign-Intervention-EN.pdf"
        }
      ]
    }
  },
  "ucdp-state-16825": {
    "ucdp-actor-8114": {
      "scope": "national",
      "countryKey": "4",
      "title": "Republic of Afghanistan",
      "administration": "Inclusive Transitional Government of Afghanistan",
      "government": "Decentralized pluralist civilian transition",
      "regime": "provisional_council",
      "regionalLaws": [
        {
          "name": "Inclusive transitional government",
          "status": "charter",
          "note": "The broader opposition council with NRF participation supports transition to an elected government.",
          "source": "https://nrcafghanistan.org/en/vision/the-charter-of-the-national-resistance-council-for-the-salvation-of-afghanistan/"
        },
        {
          "name": "Equal citizenship",
          "status": "charter",
          "note": "Ahmad Massoud advocates equal rights across gender, ethnicity and belief.",
          "source": "https://efile.fara.gov/docs/7030-Informational-Materials-20241110-27.pdf"
        }
      ],
      "laws": {
        "freedom_of_worship": 4
      }
    }
  },
  "ucdp-state-16240": {
    "ucdp-actor-7595": {
      "scope": "autonomy",
      "countryKey": "231",
      "title": "Oromia regional self-government",
      "administration": "Oromia interim regional administration",
      "government": "Oromo self-determination through a local political settlement",
      "regime": "regional_council",
      "regionKeys": [
        "ETH-3131"
      ],
      "regionalOnly": true,
      "mixed": true,
      "regionalLaws": [
        {
          "name": "Regional self-government",
          "status": "charter",
          "note": "OLA advocates Oromo self-determination and regional political change.",
          "source": "https://oromia.today/ola-publishes-a-brief-political-manifesto/"
        }
      ]
    }
  },
  "ucdp-state-750": {
    "ucdp-actor-717": {
      "scope": "national",
      "countryKey": "706",
      "title": "Islamic Emirate of Somalia",
      "administration": "Al-Shabaab administration",
      "government": "PPO counterfactual authoritarian Islamist government",
      "regime": "islamic_emirate",
      "regionalLaws": [
        {
          "name": "Parallel courts and taxation",
          "status": "in_practice",
          "note": "Parallel courts and coercive taxation operated in areas under its control.",
          "source": "https://www.euaa.europa.eu/country-guidance-somalia/security-situation-somalia-recent-events"
        }
      ],
      "laws": {
        "religion_state": 4,
        "freedom_of_worship": 0,
        "religion_in_education": 5
      }
    }
  },
};
