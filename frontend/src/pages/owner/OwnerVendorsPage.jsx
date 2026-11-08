import React, { useState, useEffect } from 'react';
import ownerService from '../../services/ownerService';
import {
  Truck,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Star,
  CheckCircle2,
  Calendar,
  Search,
  ExternalLink,
  Phone,
  Mail,
  ShieldCheck
} from 'lucide-react';

const OwnerVendorsPage = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIngredient, setSelectedIngredient] = useState('Organic Bread Flour (T65)');

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        setLoading(true);
        const res = await ownerService.getVendors();
        setVendors(res.data || res || []);
      } catch (err) {
        console.error('Failed to load vendors:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchVendors();
  }, []);

  const priceHistoryData = [
    { supplier: 'Punjab Organic Mills Co.', material: 'Organic Bread Flour (T65)', cost: '₹52 / kg', trend: '-₹2 vs last month', rating: '4.9 ★', leadTime: '24 hrs', reliability: '98%' },
    { supplier: 'Maharashtra Agro Flour Ltd.', material: 'Organic Bread Flour (T65)', cost: '₹55 / kg', trend: '+₹1 vs last month', rating: '4.6 ★', leadTime: '48 hrs', reliability: '92%' },
    { supplier: 'FarmFresh Dairy Co-op', material: 'Artisanal Cultured Butter 84%', cost: '₹580 / kg', trend: 'Stable', rating: '5.0 ★', leadTime: '12 hrs', reliability: '99%' },
    { supplier: 'Deccan Dairy Farms', material: 'Artisanal Cultured Butter 84%', cost: '₹560 / kg', trend: '-₹10 vs last month', rating: '4.4 ★', leadTime: '36 hrs', reliability: '89%' },
    { supplier: 'Callebaut Belgian Imports', material: '70% Dark Chocolate Callets', cost: '₹890 / kg', trend: 'Stable', rating: '5.0 ★', leadTime: '48 hrs', reliability: '100%' },
    { supplier: 'Malabar Spice Traders', material: 'Organic Cinnamon & Cardamom', cost: '₹1,200 / kg', trend: '-₹50 vs last month', rating: '4.8 ★', leadTime: '72 hrs', reliability: '95%' }
  ];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid #E7E5E4',
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#EFF6FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563EB'
            }}>
              <Truck size={20} />
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 'bold', color: '#1C1917', margin: 0 }}>
              Vendor Directory & Raw Material Price History
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: '#78716C', margin: '6px 0 0 44px' }}>
            Compare ingredient procurement prices across approved artisanal suppliers to optimize batch BOM margins.
          </p>
        </div>
      </div>

      {/* Supplier Directory Cards */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1C1917', marginBottom: '14px' }}>
          Approved Suppliers & Food Safety Certified Vendors
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {(vendors.length > 0 ? vendors : [
            { id: 1, name: 'Punjab Organic Mills Co.', category: 'Flours & Grains', contact_person: 'Harpreet Singh', phone: '+91 98110 44211', email: 'sales@punjaborganicmills.in', rating: 4.9, terms: 'Net 30 Days', cert: 'FSSAI + USDA Organic' },
            { id: 2, name: 'FarmFresh Dairy Co-op', category: 'Dairy & Fats', contact_person: 'Anita Deshmukh', phone: '+91 98205 77890', email: 'orders@farmfreshdairy.org', rating: 5.0, terms: 'Net 15 Days', cert: 'Cold-Chain Certified' },
            { id: 3, name: 'Callebaut Belgian Imports', category: 'Chocolates & Cocoa', contact_person: 'Rohan Mehra', phone: '+91 99302 55410', email: 'supply@callebaut-india.com', rating: 5.0, terms: 'Advance / Net 15', cert: 'Fairtrade / RainForest' }
          ]).map((v) => (
            <div
              key={v.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                padding: '20px',
                border: '1px solid #E7E5E4',
                boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#C25E00', textTransform: 'uppercase' }}>
                      {v.category || 'Bakery Ingredients'}
                    </span>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1C1917', margin: '4px 0 0' }}>
                      {v.name}
                    </h3>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#B45309', backgroundColor: '#FEF3C7', padding: '3px 8px', borderRadius: '6px' }}>
                    ★ {v.rating || '4.9'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#78716C', marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} color="#059669" />
                    <span>{v.cert || 'FSSAI Certified Food Vendor'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={14} />
                    <span>{v.phone || '+91 98200 00000'} ({v.contact_person || 'Sales Rep'})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={14} />
                    <span>{v.email || 'orders@vendor.com'}</span>
                  </div>
                </div>
              </div>

              <div style={{
                paddingTop: '12px',
                borderTop: '1px solid #F5F5F4',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#78716C'
              }}>
                <span>Terms: <strong>{v.terms || 'Net 30 Days'}</strong></span>
                <span style={{ color: '#059669', fontWeight: 600 }}>Active Contract</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vendor Price History & Comparison Matrix */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid #E7E5E4',
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1C1917', margin: 0 }}>
              Vendor Price Comparison & Historical Margin Impact
            </h2>
            <span style={{ fontSize: '12px', color: '#78716C' }}>
              Compare current and historical procurement unit prices across competing vendors
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAF9F6', borderBottom: '1px solid #E7E5E4', textAlign: 'left', color: '#78716C' }}>
                <th style={{ padding: '12px 16px' }}>Vendor Supplier</th>
                <th style={{ padding: '12px 16px' }}>Material</th>
                <th style={{ padding: '12px 16px' }}>Unit Procurement Cost</th>
                <th style={{ padding: '12px 16px' }}>Monthly Price Trend</th>
                <th style={{ padding: '12px 16px' }}>Lead Time</th>
                <th style={{ padding: '12px 16px' }}>On-Time Reliability</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Procurement Action</th>
              </tr>
            </thead>
            <tbody>
              {priceHistoryData.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #F5F5F4' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 'bold', color: '#1C1917' }}>
                    {row.supplier}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#44403C' }}>
                    {row.material}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 'bold', color: '#C25E00' }}>
                    {row.cost}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: row.trend.includes('-') ? '#DCFCE7' : row.trend.includes('+') ? '#FEE2E2' : '#F5F5F4',
                      color: row.trend.includes('-') ? '#15803D' : row.trend.includes('+') ? '#991B1B' : '#57534E'
                    }}>
                      {row.trend}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#78716C' }}>
                    {row.leadTime}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#059669', fontWeight: 600 }}>
                    {row.reliability}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => alert(`Purchase Order draft initiated for ${row.material} from ${row.supplier}`)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #D6D3D1',
                        backgroundColor: '#FFFFFF',
                        color: '#1C1917',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Issue PO
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OwnerVendorsPage;
