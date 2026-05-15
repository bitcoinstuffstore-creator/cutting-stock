# Open Source Roll Cutting Optimizer

Een web-gebaseerde Proof of Concept (PoC) voor snij-optimalisatie, ontworpen om materiaalverlies te minimaliseren en het productieproces te stroomlijnen. 

## 🏭 De Uitdaging: Het "Cutting Stock" Probleem
In veel productieomgevingen waar gewerkt wordt met materialen op rollen — zoals in de zonwering, zeilmakerijen, textielindustrie, maar ook bij folie-, papier- of staalverwerking — is het efficiënt indelen van snijplannen een complexe puzzel. 

Handmatige planning is vaak tijdrovend en leidt onvermijdelijk tot onnodig restmateriaal (verknip). Het doel van deze tool is om dit wiskundige optimalisatievraagstuk (bekend als het *1D/2D Cutting Stock Problem*) laagdrempelig en visueel op te lossen.

## ✨ Kernfunctionaliteiten
Deze tool is ontworpen met de realiteit van de fabrieksvloer in gedachten:
* **Slimme Import:** Upload direct exportbestanden (.xlsx, .csv) vanuit bestaande ERP- of ordersystemen.
* **Automatische Batching:** Orders worden direct gegroepeerd op materiaal- en kleurcode, zodat productielijnen soepel kunnen doorwerken.
* **Prioriteit & Deadlines:** Het algoritme houdt niet alleen rekening met afmetingen, maar sorteert ook op productiedeadline en spoed-prioriteit.
* **Visuele Output:** Direct visueel inzicht in de benutting van de rol en het verwachte restmateriaal.

## 🚀 Brede Toepasbaarheid
Hoewel de logica in deze PoC in eerste instantie is geïnspireerd door uitdagingen binnen de industriële textiel- en zonweringsbranche (met parameters zoals *naadtoeslag* en de keuze of *weefrichting* mag draaien), is de fundamentele code breed inzetbaar. 

Elke industrie die lineaire of rechthoekige eenheden uit een grotere basisrol of plaat moet snijden, kan deze logica gebruiken en verder uitbreiden.

## 🛠️ Gebruik en Ontwikkeling
Dit project is open-source. De huidige versie betreft een front-end Proof of Concept gebouwd met HTML, Tailwind CSS en Vanilla JavaScript (inclusief SheetJS voor lokale bestandsprocessing). Omdat berekeningen *client-side* (in de browser) plaatsvinden, blijft bedrijfsdata veilig en is er geen backend database nodig voor basisgebruik.

Bijdragen aan het optimalisatie-algoritme, restmateriaal-beheer (offcuts) of defect-tracking zijn zeer welkom!
