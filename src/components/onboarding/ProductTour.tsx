import { useCallback, useEffect, useRef } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/useOnboarding';

const STEPS = [
  {
    element: '[data-tour="sidebar"]',
    popover: {
      title: 'Menu principal',
      description: 'Aqui ficam seus módulos: Cotações, Embarques, Financeiro, Cadastros e Configurações.',
    },
  },
  {
    element: '[data-tour="plan-badge"]',
    popover: {
      title: 'Seu plano',
      description: 'Consulte seu plano ativo e os dias restantes. Faça upgrade quando precisar de mais recursos.',
    },
  },
  {
    element: '[data-tour="checklist"]',
    popover: {
      title: 'Primeiros passos',
      description: 'Siga esta lista para configurar sua empresa e começar a operar rapidamente.',
    },
  },
  {
    element: '[data-tour="support"]',
    popover: {
      title: 'Suporte',
      description: 'Reporte bugs, envie sugestões ou tire dúvidas. Nossa equipe responde por aqui.',
    },
  },
  {
    popover: {
      title: 'Pronto para começar!',
      description: 'Você pode rechamar este tour a qualquer momento pelo card de primeiros passos.',
    },
  },
];

let driverInstance: Driver | null = null;
let startFn: (() => void) | null = null;

export function useProductTour() {
  const startTour = useCallback(() => {
    if (startFn) startFn();
  }, []);
  return { startTour };
}

export function ProductTour() {
  const { user, profile } = useAuth();
  const { tourSeen, markTourSeen } = useOnboarding();
  const autoStarted = useRef(false);

  const start = useCallback(() => {
    if (!driverInstance) {
      driverInstance = driver({
        showProgress: true,
        allowClose: true,
        nextBtnText: 'Próximo',
        prevBtnText: 'Anterior',
        doneBtnText: 'Concluir',
        progressText: '{{current}} de {{total}}',
        steps: STEPS.filter(s => !s.element || document.querySelector(s.element as string)) as any,
        onDestroyed: () => { markTourSeen(); },
      });
    }
    driverInstance.drive();
  }, [markTourSeen]);

  useEffect(() => {
    startFn = start;
    return () => { if (startFn === start) startFn = null; };
  }, [start]);

  useEffect(() => {
    if (autoStarted.current) return;
    if (!user || !profile) return;
    if (tourSeen) return;
    if ((profile as any).must_change_password) return;
    autoStarted.current = true;
    const timer = setTimeout(() => start(), 1200);
    return () => clearTimeout(timer);
  }, [user, profile, tourSeen, start]);

  return null;
}