/**
 * Preset search configurations for the researcher's specific scraping needs.
 */
const PRESETS = [
    {
        id: 'lsd-longcovid',
        title: 'LSD in Long COVID subs',
        terms: ['LSD'],
        subreddits: ['longcovid', 'covidlonghaulers'],
        description: 'Term "LSD" in r/longcovid + r/covidlonghaulers'
    },
    {
        id: 'mdma-longcovid',
        title: 'MDMA in Long COVID subs',
        terms: ['MDMA'],
        subreddits: ['longcovid', 'covidlonghaulers'],
        description: 'Term "MDMA" in r/longcovid + r/covidlonghaulers'
    },
    {
        id: 'dmt-aya-longcovid',
        title: 'DMT / Ayahuasca in Long COVID subs',
        terms: ['DMT', 'ayahuasca'],
        subreddits: ['longcovid', 'covidlonghaulers'],
        description: 'Terms "DMT" + "ayahuasca" in r/longcovid + r/covidlonghaulers'
    },
    {
        id: 'propranolol-lsd',
        title: 'Propranolol / Inderal in r/LSD',
        terms: ['propranolol', 'inderal'],
        subreddits: ['LSD'],
        description: 'Terms "Propranolol" + "inderal" in r/LSD'
    },
    {
        id: 'propranolol-shrooms',
        title: 'Propranolol / Inderal in shroom subs',
        terms: ['propranolol', 'inderal'],
        subreddits: ['shrooms', 'psilocybin'],
        description: 'Terms "Propranolol" + "inderal" in r/shrooms + r/psilocybin'
    },
    {
        id: 'psilocybin-longcovid',
        title: 'Psilocybin in Long COVID subs',
        terms: ['psilocybin', 'shrooms'],
        subreddits: ['longcovid', 'covidlonghaulers'],
        description: 'Terms "psilocybin" + "shrooms" in r/longcovid + r/covidlonghaulers'
    }
];

/**
 * The coding columns from the BPD/Psilocybin codebook.
 * These are exported as empty columns so the researcher can fill them in.
 */
const CODING_COLUMNS = [
    'Gender',
    'Trans',
    'Age',
    'Co-morbid psych disorder',
    'Hx of substance misuse/dependence',
    'Unknown Drug used',
    'Psilocybin',
    'LSD',
    'MDMA',
    'DMT',
    'Mescaline/Peyote',
    'Other substance',
    'Multiple psychedelic drugs at the same time',
    'Problematic Use of psychs',
    'Using as treatment',
    'Using for recreation',
    'Dose of Drug',
    'Repeat Dosing',
    'Microdosing',
    'Alone',
    'Sitter Present',
    'Taken in group setting',
    'Overall Positive Valence',
    'Overall Negative Valence',
    'Overall Neutral Valence',
    'Challenging Experience',
    'Serious Challenging Experience',
    'Mystical Experience',
    'Psychotic features / dissociation',
    'Mentioned effect on well-being',
    'Mentioned effect on condition specifically',
    'Mental well-being improved',
    'MH improvement wane',
    'Condition symptoms improvement',
    'Condition improvement waned',
    'Behavioral Dysregulation (improvement)',
    'Emotional Dysregulation (improvement)',
    'Suicidal Behavior/Self Harm (improvement)',
    'Suicidal Ideation (improvement)',
    'Mindfulness (improvement)',
    'Identity Disturbance/self direction (improvement)',
    'Social Functioning (improvement)',
    'Improved dissociation',
    'Mental well-being worsening after experience',
    'Did worsening wane',
    'Condition symptoms worsened',
    'Condition worsening waned',
    'Behavioral Dysregulation (worsening)',
    'Emotional Dysregulation (worsening)',
    'Suicidal Behavior/Self Harm (worsening)',
    'Suicidal Ideation (worsening)',
    'Mindfulness (worsening)',
    'Identity Disturbance/self direction (worsening)',
    'Social Functioning (worsening)',
    'Psychosis/Severe Dissociation after',
    'Other Lasting Adverse effects',
    'Other lasting benefits',
    'Subjective Other Adverse Effects',
    'Subjective Other benefits',
    'Other Interesting observations',
    'Notable Quotes',
    'Other notes'
];
