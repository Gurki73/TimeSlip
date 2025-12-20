import { saveStateData } from '../loader/calendar-loader.js';

export const stateFlags = {
    XX: { src: './assets/png/wappen-nimmerland.png', alt: 'Nimmerland' },
    BY: { src: './assets/png/wappen-Bayern.png', alt: 'Bayern' },
    BB: { src: './assets/png/wappen-brandenburg.png', alt: 'Brandenburg' },
    BW: { src: './assets/png/wappen-badenWuertenberg.png', alt: 'Baden-Württemberg' },
    BE: { src: './assets/png/wappen-berlin.png', alt: 'Berlin' },
    SN: { src: './assets/png/wappen-sachsen.png', alt: 'Sachsen' },
    ST: { src: './assets/png/wappen-sachsenAnhalt.png', alt: 'Saxony-Anhalt' },
    SL: { src: './assets/png/wappen-Saarland.png', alt: 'Saarland' },
    NI: { src: './assets/png/wappen-niedersachsen.png', alt: 'Niedersachsen' },
    MV: { src: './assets/png/wappen-MeVoPO.png', alt: 'Mecklenburg-Vorpommern' },
    NW: { src: './assets/png/wappen-nrw.png', alt: 'Nordrhein Westfalen' },
    RP: { src: './assets/png/wappen-rheinlandPfalz.png', alt: 'Rheinland Pfalz' },
    SH: { src: './assets/png/wappen-schleswigHolstein.png', alt: 'Schleswig-Holstein' },
    HE: { src: './assets/png/wappen-hessen.png', alt: 'Hessen' },
    TH: { src: './assets/png/wappen-thüringen.png', alt: 'Thüringen' },
    HH: { src: './assets/png/wappen-hamburg.png', alt: 'Hamburg' },
    HB: { src: './assets/png/wappen-bremen.png', alt: 'Bremen' },
};

export function updateStateFlag(state, stateElement) {
    const flag = stateFlags[state];
    if (flag) {
        stateElement.style.backgroundImage = `url(${flag.src})`;
        stateElement.style.backgroundSize = 'contain';
        stateElement.style.backgroundRepeat = 'no-repeat';
        stateElement.style.backgroundPosition = 'center';
        stateElement.setAttribute('aria-label', flag.alt);
    } else {
        console.warn(`⚠️ No flag found for state: ${state}, using Nimmerland.`);
        const fallback = stateFlags['XX'];
        if (fallback) {
            stateElement.style.backgroundImage = `url('./assets/png/wappen-nimmerland.png')`;
            stateElement.style.backgroundSize = 'contain';
            stateElement.style.backgroundRepeat = 'no-repeat';
            stateElement.style.backgroundPosition = 'center';
            stateElement.setAttribute('aria-label', fallback.alt);
        }
    }
}

