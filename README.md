# BIMCONTROL Viewer

Visualitzador IFC basat en [xeokit-sdk](https://github.com/xeokit/xeokit-sdk) per a la gestió de models BIM.

## 📋 Descripció

Aquest mòdul proporciona components React per visualitzar i interactuar amb models IFC (Industry Foundation Classes). Inclou funcionalitats com:

- **Visualització 3D** de models IFC amb xeokit-sdk
- **Navegació per l'arbre del model** (ModelTreeView)
- **Anotacions i marcadors** sobre elements 3D
- **Mesuraments automàtics** i manuals
- **Generació de documentació** tècnica
- **Gestió de versions** del model
- **Control d'opacitat** i seccions
- **Integració amb pressupostos** i proveïdors

## 🗂️ Components principals

| Component | Descripció |
|-----------|------------|
| `XeokitViewer.tsx` | Visualitzador principal xeokit |
| `IFCViewer.tsx` | Wrapper del visualitzador IFC |
| `PublicXeokitViewer.tsx` | Visualitzador públic (sense autenticació) |
| `ModelTreeView.tsx` | Arbre de navegació del model |
| `AnnotationModal.tsx` | Gestió d'anotacions |
| `BudgetViewModal.tsx` | Visualització de pressupostos |
| `MeasurementsStatusModal.tsx` | Estat dels amidaments |

## 🔧 Tecnologies

- **xeokit-sdk** - Motor de visualització 3D/BIM
- **React** + **TypeScript**
- **Tailwind CSS** - Estils
- **Leaflet** - Mapes per ubicació

## 📦 Dependències principals

```json
{
  "@xeokit/xeokit-sdk": "^2.6.93",
  "react": "^18.3.1",
  "leaflet": "^1.9.4"
}
```

## 🚀 Ús

```tsx
import { XeokitViewer } from './components/viewer/XeokitViewer';

function App() {
  return (
    <XeokitViewer 
      ifcUrl="/path/to/model.ifc"
      onModelLoaded={(model) => console.log('Model carregat', model)}
    />
  );
}
```

## ⚖️ Llicència

### AGPLv3 (GNU Affero General Public License v3.0)

Aquest mòdul utilitza **xeokit-sdk**, que està llicenciat sota **AGPLv3**.

D'acord amb els termes de l'AGPLv3:
- Els usuaris que interactuen amb aquest programari a través de la xarxa tenen dret a rebre el codi font.
- El codi font complet d'aquesta aplicació està disponible sota petició.

### xeokit-sdk

```
Copyright (c) 2020, xeolabs
Licensed under the GNU Affero General Public License v3.0

Repositori original: https://github.com/xeokit/xeokit-sdk
NPM: https://www.npmjs.com/package/@xeokit/xeokit-sdk
```

El text complet de la llicència AGPLv3: https://www.gnu.org/licenses/agpl-3.0.html

### Modificacions

Aquest programari utilitza xeokit-sdk sense modificacions al codi font original del SDK.

## 📧 Contacte

Per accés al codi font o consultes sobre la llicència, contacteu amb els mantenidors del projecte.

---

© BIMCONTROL
