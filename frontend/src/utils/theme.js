/**
 * Ant Design Theme Configuration
 * Tailored to match Crumb&Co. Figma Design Palette
 */
export const antdBakeryTheme = {
  token: {
    colorPrimary: '#D86D8B',           // Signature Rose Berry CTA
    colorLink: '#D86D8B',
    colorLinkHover: '#C25B77',
    colorSuccess: '#2E7D32',
    colorWarning: '#ED6C02',
    colorError: '#D32F2F',
    colorTextBase: '#2E221D',
    colorBgBase: '#FFFFFF',
    fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: 12,
    wireframe: false,
  },
  components: {
    Button: {
      colorPrimary: '#D86D8B',
      colorPrimaryHover: '#C25B77',
      colorPrimaryActive: '#AC4C65',
      borderRadius: 9999, // Pill style buttons as seen across Figma
      controlHeight: 42,
      fontWeight: 600,
    },
    Input: {
      borderRadius: 12,
      colorBorder: '#DCCEC1',
      hoverBorderColor: '#5A3825',
      activeBorderColor: '#5A3825',
    },
    Select: {
      borderRadius: 12,
      colorBorder: '#DCCEC1',
    },
    Rate: {
      colorFillContent: '#E5D5C5',
      colorPrimary: '#F59E0B',
    },
    Badge: {
      colorPrimary: '#EAB308',
    },
    Steps: {
      colorPrimary: '#5A3825',
    },
  },
};
