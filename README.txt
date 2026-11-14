Politics and Party Overhaul (PPO)

This Windows patch supports Geoplanetical 1.1.3, Windows Steam depot 940231, manifest 8236681092122022097 (app builds 26650961 and 26651281). Install Node.js LTS from https://nodejs.org/en/download if needed. Allow about 4 GB of free space on the Steam library drive for backups and staging.

Close Geoplanetical and use Extract All on the PPO installer ZIP. Double-click Install Party Mod.cmd in the extracted folder. Run the new installer again to update a recognized PPO installation, including after Steam Verify Integrity restores the supported game files. Once the installer reports success, start the game through Steam. If Steam discovery fails, find the game folder with Steam's Browse Local Files and pass that folder as a quoted argument to Install Party Mod.cmd.

New campaigns start with 12 playable wartime administrations across Sudan, Yemen, Somalia, Libya, Myanmar, the Democratic Republic of the Congo, and Syria. Each uses the game's country inspector, flag, leadership, governing institutions, military, and diplomacy. Libya keeps its opening ceasefire. Existing campaigns retain their saved territorial ownership.

The Political map shows territorial control in both opening conflicts and wars that start during play. Faction names follow the shape of each connected area the faction governs. Zoom in for smaller territories and select their terrain to open the faction's profile in the right-hand inspector. Contested provinces blend the sides' colors toward the dominant side. Select one to see a military-control box beside the cursor. It shows percentages when the simulation has them. During a war, fully captured provinces use a slightly lighter shade of the captor's color and a dim yellow dashed border. Once the war settles, the map returns to its regular ownership colors and borders.

The Strategic map shows documented conflict areas and modeled fronts, including the Russia–Ukraine war. New wars appear there once the simulation models a front. Choose a diamond or outlined province for details. Cartel and gang reports appear as Strategic diamonds where they have a mapped location. Use Conflicts to show ceasefires or occupations. Satellite keeps its ordinary globe presentation.

Documented opening control in Rakhine uses township boundaries for the Arakan Army. Paletwa, Chipwi, Tonzang, Kyaikdon, Goma, Bukavu, Raqqa and Suwayda use mapped town or city boundaries. These holdings have their own province records. The remainder of each original province keeps its own government. Boundary sources are credited in the historical opening-area JSON files. Population shares use existing game weights, stock city records, and 2014 Myanmar census urban counts as scenario weights.
Myanmar census, Table A-3: https://unstats.un.org/unsd/demographic-social/census/documents/Myanmar/MMR-2015-05.pdf

Open Defense > Historical Conflicts to browse active wars and view regional control maps and percentage bars. Incident reports, participants, sources and negotiations can be expanded when needed. A wartime independence or national government change requires a decisive result in the game's military simulation or an explicit concession from the incumbent government. Existing settlements stay in the save.

Dossier portraits marked Illustrative portrait depict fictional people. Where a real leader is documented, their name and role are shown separately. Where an opening leader is unverified, a locally appropriate name appears under Fictional scenario character. These dossier illustrations do not replace people in the campaign simulation.

Sudan's native theatre labels the breakaway Rapid Support Forces on the globe, with its documented banner. Its country profile retains Government of Peace and Unity and shows Mohamed Hamdan Dagalo. A decisive Tasis victory installs that government as the Republic of Sudan. A negotiated white peace retains both wartime authorities. When a new historical state forms, PPO uses its sourced flag when available or the winning faction's banner provisionally. Historical portraits are tied to the specific incumbent. A new generated officeholder uses the game's portrait system. The historical-identities JSON files include image credits and sources.

The English interface uses official country titles for the January 1, 2026 scenario, including Lebanese Republic, Democratic People's Republic of Korea, and United States of America. The list covers 212 playable entries and 25 map-only entries. Places without a separate formal title use their established country or territory name. Custom country names in saves take precedence. Use the short country name or official title in the new-game country search.

The list follows the UK FCDO geographical names index and UN country naming references. Where usage differs, it uses the local title for Afghanistan (Islamic Emirate of Afghanistan), Taiwan (Republic of China), and Northern Cyprus (Turkish Republic of Northern Cyprus). The game's January 2026 scenario uses Republic of Nauru, before the later change to Republic of Naoero. These are scenario display labels.

Naming sources:
https://www.gov.uk/government/publications/geographical-names-and-information
https://conferences.unite.un.org/unterm/download/country
https://mfa.gov.af/en/En/
https://english.president.gov.tw/page/94
https://pio.mfa.gov.ct.tr/en/administration/
https://www.un.org/en/about-us/member-states/naoero

Contains public sector information licensed under the Open Government Licence v3.0.
https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/

To rename a party, load a campaign and go to My Party. Click Rename Party, choose a party in your country, and enter its name and optional abbreviation. Save the campaign to keep the change.

In Politics > Electorate, use the Panel width slider and expand a voter bloc. The Vote split lists every party in the estimate with its color, abbreviation, and vote share to up to two decimal places. Hover over an abbreviation to see the full party name. The slider remembers your preferred width for Electorate.

In Politics > Assembly, expand a party to see its estimated ideology and all four signed scores on a -100 to +100 scale. My Party shows the same estimate for the party you lead. If you choose an unchanged preset when founding a party, its name is recorded separately as the founding preset. Law, assent, and constitutional reform results use the party's ideology at the time of the ballot. For older records, the mod uses the saved party profile when available and falls back to the recorded label. The game uses the original party families for its rules.

In My Party > Party organizing, choose a voter bloc and check the cash, influence, activists, dates, and projected gain before committing. A public meeting runs for 21 days. Your party can start one every 30 days and can return to the same bloc after 90 days. Blocs with a strong grassroots network, a good platform fit, and high party credibility offer the largest gains.

Back a live, unresolved peaceful mobilization to organize among the groups taking part. The project runs for up to 14 days. It ends early if the movement resolves or becomes ineligible, with gains earned so far still credited. Backing has a 60-day party cooldown and is available once per movement. Both types of project charge cash and influence at the start and return assigned activists at the end.

Meetings and backing share a +50% local voting-weight cap per party and bloc. Each new project's quoted gain is scaled by the fraction of the cap still available. Existing bonuses halve every 180 days. These bonuses affect the bloc vote calculation and flow through the game's normal national support calculation. They represent a relative boost to your party's weight within a bloc.

In My Party, open Party Congress to see estimated ideological factions in an Assembly-style semicircle. Each dot represents one modeled delegate. Congress starts at 100 delegates.

Use the slider to propose a Congress of 50 to 200 delegates. Check each faction's current and proposed representation, reasons, and expected yes and no votes. A faction can gain delegates but still oppose the motion if its share of Congress shrinks. More than half of the current delegates must vote yes. On a motion forecast to fail, you can offer one opposing faction an organizing grant to persuade some of its delegates. The preview shows the cost and extra votes. The party treasury pays the grant only if the motion passes.

Congress also votes on a campaign priority. For 90 days, the chosen project (regional rallies or local investment) costs 20% less cash and the other costs 15% more. These prices apply when you start a new project. The current delegates vote, with factions weighing whether to favor shorter campaigns or lasting party networks.

Each ballot has a 14-day wait before it can be held again. An adopted campaign priority runs its full 90 days before Congress can replace it. The approved delegate count, last results, waiting periods, and active priority are stored in the campaign save. Existing campaigns keep their approved delegate count.

The estimate combines your party's platform with its supporters' electorate-bloc leanings and the political figures the game tracks. Factions use the same four-axis ideology labels as Assembly. Hover over a faction to highlight its seats and see any associated figures.

Open My Party > Law Shortlist to see changes that move current laws closer to your party's position. The list puts proposals forecast to pass first, followed by the closest votes. Compare the proposed change, estimated votes, and any veto or court risk. Refresh to recalculate. Review proposal opens the game’s law screen with the suggested change selected. Your party must still meet the normal rules for introducing a bill.

Open My Party > Uprising as a legal opposition party without assembly seats in an eligible sovereign country at peace. The declaration shows the headquarters starting region, the proposed constitution, a selection of country- and ideology-based names, and the founding laws. The region must be outside the capital and share a land border with the rest of the country. The naming recommendation is stable for the campaign, and you can select a different proposed name before declaring.

Open the Uprising Map to compare regional footholds on a fixed color scale. The region list shows exact percentages. Use the Projected Control layer to see where the government and breakaway would start, and look for the outlined party headquarters. Foothold comes from local vote share, permanent regional presence, headquarters, and completed wing investments.

To declare, establish your party headquarters in an eligible region outside the capital, build at least 60% foothold there, and finish training at least one division. You can establish or relocate the same headquarters from the Uprising tab. The previous headquarters stays open until a relocation finishes. Form the party wing to unlock regional foothold investments and division training. Up to two regional investments run at once. Each takes 21 days and adds up to 20 percentage points below 50% foothold or 16 points from 50% onward. Connected regions at 60% can join at declaration. The incumbent keeps the capital and at least 20% of the population.

The wing can initially prepare two divisions. Each eligible region at 30% foothold adds one slot, and an eligible headquarters at 60% adds another. Choose infantry, motorized, mechanized, or artillery with a Basic or Standard equipment package. The quote shows equipment quantities, training time, and treasury cost. Foreign military aid remains separate from Foreign Funding. Each accepted aid credit reduces the next division's treasury cost by $24,000. Completed divisions deploy at headquarters. Unfinished projects end at declaration. Preparations carry over in existing saves, including previously trained infantry. Wars already underway continue with their existing territories and units.

The breakaway uses the party's current ideology. A socialist one-party state and a multiparty parliamentary republic can have different constitutions, assembly rules, and founding laws. An uprising with the same broad political system as the country at campaign start uses a Revolutionary Government name during the war and restores the starting country title if it wins. For older saves, PPO recovers the starting system from the saved constitutional blueprint and uses the scenario title. Other breakaways keep their chosen name after victory. You can upload an uprising banner before declaring. The breakaway uses that banner and adopts it nationally if it wins. Without an upload, the breakaway uses the parent country's flag. On a decisive breakaway victory, the original country keeps its game ID and adopts the breakaway constitution and charter. A multiparty outcome preserves the existing assembly seats until an election. A government victory restores incumbent control and bans the founding party. Base national support is tracked separately from political control.

Open Support Base beside Party Congress to see which electorate blocs contribute the most to your party's estimated voters. The bar and large percentage show the bloc's share of your party's support. The smaller percentage shows your party's estimated support within that bloc.

Open My Party > Regional Campaigning to compare your party's estimated vote share by state or province. Lighter blue means a higher estimated vote share. The legend shows the local range and reserves at least two percentage points so small shifts do not dominate the colors. Regions beyond either end share the nearest shade. Hover over a region or use the Region menu for its exact estimate. Click a region or use the Region menu, then select Open Campaign Map to open the globe with that region selected. The globe panel shows the local vote estimate, leading party, margin, and your party's presence. Each project shows its cost, activists, and duration before you commit. Advance time after leaving the map to complete the projects.

A rally takes seven days. New rallies hold their full boost for 21 days, then halve every 60 days. A local investment takes 42 days and builds lasting party presence. The quoted odds determine whether growth is strong or modest. Established regions gain less presence from each new investment. Presence adds local voting weight and lowers future rally costs in that region.

Your party can establish one headquarters. It takes 28 days to open and adds 12% to your party's local voting weight while the headquarters is there. Voting weight is normalized against other parties' support, so this is a smaller change in actual vote share. The panel shows the resulting change in percentage points. Regional gains feed elections using regional results and contribute by population to nationwide voting. Projects, investment outcomes and headquarters locations are saved with the campaign.

The regional map shows projected national support, seats, and the applicable vote threshold. The globe panel breaks out lasting presence and headquarters gains from temporary rally gains. Project previews estimate how much support the action would add on completion if other conditions hold. The game still applies its normal election rules.

Open My Party > Foreign Funding to request a one-time grant from a party in another country. The offer preview shows ideology, solidarity, electoral traction, and the donor treasury limit. Closely aligned parties are more willing to fund new parties. Authoritarian-left parties can have additional solidarity based on their economic and governance positions. A donor still needs enough money to make an offer. You can have one request or deal active, with 120 days between approaches. Review the amount, terms, and exposure risk before accepting. Accepted funds go directly into your party treasury.

Declared backing is public and costs a small amount of party credibility. Private backing can be exposed within 90 days. If that happens, your party loses credibility and has 30 days to return the unspent portion or keep the grant. Returning funds reduces the additional credibility loss. Party spending reduces the returnable balance, and later fundraising does not restore it. Requests, offers, and grants are saved with the campaign.

Rival parties consider the same organizing projects during the game's monthly party decision cycle. Their decisions account for available cash, activists, influence, and the next election.

From New Game, select a country and open Campaign Rules on the role screen. Standard keeps the usual pace and helps small parties slightly. Easy gives a newly created party more resources and support, lowers campaign costs for everyone, and uses simpler AI planning. Competitive uses stronger AI planning, faster decay, and local presence upkeep. Change any setting to use Custom. The game saves campaign rules with the campaign.

Choose Create Party to found a new party. Set its name and ideology before starting. Funding, activists, influence, national support, regional presence, and opening seats apply once to the new party. Standard starts with zero seats and up to 2.5% support. The available party roster may lower the support target. Custom starting seats come from the principal elected chamber where eligible. Its total seats stay fixed, and the new party starts outside government. A party holding seats is ineligible to declare an uprising.

Player and AI parties use the same campaign quotes, cooldowns, and decay rules. In Regional Campaigning or on the Campaign Map, open Support Breakdown for a region. It shows each party's baseline, local presence, headquarters, rally gains, and the effect of rival campaigns. Existing saves keep their founding position and existing project terms.

Islamic Democracy, Islamic Republicanism, Islamic Fundamentalism, Fascism, Maoism, Democratic Confederalism, Anarcho-Syndicalism and Ecosocialism add distinct platforms. Their law priorities appear in the Law Shortlist as the game can forecast a valid proposal. They supply founding institutions and laws when the party wins a declared uprising. In historical conflicts, specific factions' names, mandates, and laws come from their own opening and settlement records.

The native executive model allows one officeholder per office. Democratic Confederalism uses a confederal structure with constitutional civil protections. Anarcho-Syndicalism uses a confederal structure with protected unions and strikes. Co-leadership and worker control of individual firms are represented in the documented program.

To remove the patch, close Geoplanetical and run Restore Original Game.cmd. Steam updates can replace the patched files. The installer checks the supported game files before making any changes. The restore command keeps newer Steam files if they have replaced the patched files.

Existing modded campaigns retain organizing bonuses, cooldowns, endorsement history, and ongoing organizing projects.

Custom party persistence: the game can automatically merge small, similar parties or remove a party after prolonged low support. This update protects custom parties from those two automatic removal rules, including custom parties in older saves. They can still lose support, lose elections, and remain in opposition. If a party has already disappeared from a save, load an earlier save where the party still exists after installing the update.
