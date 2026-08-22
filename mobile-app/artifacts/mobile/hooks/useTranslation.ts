import { useSettings } from "@/context/SettingsContext";
import { translations } from "@/i18n/translations";

export function useTranslation() {
  const { settings } = useSettings();
  const language = settings.language;
  
  const t = (key: string): string => {
    return translations[language]?.[key] ?? translations.en[key] ?? key;
  };
  
  return { t, language };
}
