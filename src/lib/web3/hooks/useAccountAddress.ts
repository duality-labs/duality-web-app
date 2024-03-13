import { useEffect, useRef, useState } from 'react';

type GlobalConsentState = {
  dataLayer?: object[];
  isConsentGranted?: (key: string) => false;
  addConsentListener?: (
    consentType: string,
    callback: (consentType: string, granted: boolean) => void
  ) => void;
  removeConsentListener?: (
    consentType: string,
    callback: (consentType: string, granted: boolean) => void
  ) => void;
};
const w = window as unknown as Window & GlobalConsentState;

// don't add the hook if it's not wanted in this environment
export default import.meta.env.REACT_APP__GOOGLE_TAG_USER_ID_TRACKING
  ? function useAccountAddress(address: string | null) {
      // start with no tracking consent
      const [userIdConsentGranted, setUserIdConsentGranted] = useState(false);

      // find out when the Tag Manager custom API is available to use
      const [gtmIsReady, setGtmIsReady] = useState(false);
      useEffect(() => {
        let delay = 100;
        let timeout: ReturnType<typeof setTimeout>;
        const check = () => {
          if (w.isConsentGranted) {
            setGtmIsReady(true);
          } else {
            // add a linear backoff delay
            delay += 100;
            timeout = setTimeout(check, delay);
          }
        };
        check();
        return () => clearTimeout(timeout);
      }, []);

      // sync React consent state with Tag Manager state
      // using global window hooks that expose Tag Manager's
      // isConsentGranted: https://developers.google.com/tag-platform/tag-manager/templates/api#isconsentgranted
      // addConsentListener: https://developers.google.com/tag-platform/tag-manager/templates/api#addconsentlistener
      // removeConsentListener: added custom handler to not accumulate callbacks
      // in a custom template tag in some environments (such as beta)
      useEffect(() => {
        if (gtmIsReady) {
          // set value
          setUserIdConsentGranted(!!w.isConsentGranted?.('user_id_storage'));

          // or wait for value to be set
          const onConsentChange = (_: string, granted: boolean) => {
            setUserIdConsentGranted(granted);
          };
          w.addConsentListener?.('user_id_storage', onConsentChange);
          return () => {
            w.removeConsentListener?.('user_id_storage', onConsentChange);
          };
        }
      }, [gtmIsReady]);

      // if and only if the user has given consent, then add the userId to GTM
      const previousSetUserIdRef = useRef<string | null>(null);
      useEffect(() => {
        // add userId to custom event if Tag Manager is available
        // this custom event can trigger use of the userId in GA4 and other apps
        w.dataLayer = w.dataLayer || [];
        // add userId
        if (userIdConsentGranted) {
          // the address is allowed to be `null`, ie. unset the userId
          w.dataLayer.push({ event: 'userIdSet', userId: address });
          // set previous value for next effect
          previousSetUserIdRef.current = address;
        }
        // remove previous userId if consent was changed to not granted
        else if (previousSetUserIdRef.current) {
          w.dataLayer.push({ event: 'userIdSet', userId: null });
        }
      }, [address, userIdConsentGranted]);
    }
  : () => undefined;
