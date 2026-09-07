import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { FlaskConical, Activity, UserPlus, Syringe, DollarSign, Database, AlertTriangle, Package } from 'lucide-react';
import { getSocket, joinRoom } from '../utils/socket';
import useSocketStore from '../store/useSocketStore';
import { formatArabicQuantity, formatArabicItemsCount, getSmartItemText } from '../utils/arabicFormatters';

/**
 * useRealtimeNotifications — connects to Socket.IO and listens to role-specific events.
 * Call this once at the top-level component (e.g., Layout or App).
 * @param {string} role - user role string
 */
const useRealtimeNotifications = (role) => {
  const { setPatientEvent, setLabEvent, setRadiologyEvent, setSilentUpdate, addNotification } = useSocketStore();
  useEffect(() => {
    if (!role) return;

    const socket = getSocket();
    joinRoom(role);

    const isStoreRole = role === 'general_store' || role === 'or_store';

    if (!isStoreRole) {
      // ── Cashier: new patient registered by secretary ──
      socket.on('patient:registered', (data = {}) => {
        const patientName = data.patientName || data.patient_name || 'مريض';
        toast.info(
          <div className="flex items-center gap-3">
            <UserPlus size={20} className="text-white" />
            <span className="font-semibold text-sm">مريض جديد: {patientName}</span>
          </div>, {
            position: 'bottom-right',
            autoClose: 6000,
            icon: false,
          }
        );
      });

      // ── Doctor: patient moved to waiting ──
      socket.on('patient:waiting', (data = {}) => {
        const fullName = data.patientName || data.patient_name;
        const baseMessage = data.message || 'تم إضافة مريض جديد لقائمة الانتظار';
        const finalMessage = fullName ? `${baseMessage} - ${fullName}` : baseMessage;
        setPatientEvent({ message: finalMessage, ...data });
        toast.success(
          <div className="flex items-center gap-3">
            <UserPlus size={20} className="text-white" />
            <span className="font-semibold text-sm">{finalMessage}</span>
          </div>, {
            position: 'bottom-right',
            autoClose: 5000,
            icon: false,
          }
        );
      });

      // ── Lab/Radiology: new request ──
      socket.on('request:new', (data = {}) => {
        const baseMessage = data.message || 'طلب خدمة جديد';
        setLabEvent({ message: baseMessage, ...data });
        toast.info(
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-white" />
            <span className="font-semibold text-sm">{baseMessage}</span>
          </div>, {
            position: 'bottom-right',
            autoClose: 6000,
            icon: false,
          }
        );
      });

      // ── Doctor: lab completed ──
      socket.on('lab:completed', (data = {}) => {
        const fullName = data.patientName || data.patient_name;
        const baseMessage = data.message || 'تم إنجاز التحليل';
        const finalMessage = fullName ? `${baseMessage} - ${fullName}` : baseMessage;
        setLabEvent({ message: finalMessage, ...data });
        toast.success(
          <div className="flex items-center gap-3">
            <FlaskConical size={20} className="text-white" />
            <span className="font-semibold text-sm">{finalMessage}</span>
          </div>, {
            position: 'bottom-right',
            autoClose: 6000,
            icon: false,
          }
        );
      });

      // ── Doctor: radiology completed ──
      socket.on('radiology:completed', (data = {}) => {
        const fullName = data.patientName || data.patient_name;
        const baseMessage = data.message || 'تم إنجاز الأشعة';
        const finalMessage = fullName ? `${baseMessage} - ${fullName}` : baseMessage;
        setRadiologyEvent({ message: finalMessage, ...data });
        toast.success(
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-white" />
            <span className="font-semibold text-sm">{finalMessage}</span>
          </div>, {
            position: 'bottom-right',
            autoClose: 6000,
            icon: false,
          }
        );
      });

      // ── Surgery Coordinator: new referral ──
      socket.on('surgery:new_referral', ({ message }) => {
        toast.info(
          <div className="flex items-center gap-3">
            <Syringe size={20} className="text-white" />
            <span className="font-semibold text-sm">{message}</span>
          </div>, {
            position: 'bottom-right',
            autoClose: 6000,
            icon: false,
          }
        );
      });

      // ── Surgery Coordinator: payment received ──
      socket.on('surgery:payment_received', ({ message }) => {
        toast.success(
          <div className="flex items-center gap-3">
            <DollarSign size={20} className="text-white" />
            <span className="font-semibold text-sm">{message}</span>
          </div>, {
            position: 'bottom-right',
            autoClose: 6000,
            icon: false,
          }
        );
      });

      // ── Backup notifications ──
      socket.on('backup:done', ({ file }) => {
        toast.success(
          <div className="flex items-center gap-3">
            <Database size={20} className="text-white" />
            <span className="font-semibold text-sm">نسخ احتياطي: {file}</span>
          </div>, { autoClose: 8000, icon: false }
        );
      });
      socket.on('backup:failed', ({ message }) => {
        toast.error(
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-white" />
            <span className="font-semibold text-sm">{message}</span>
          </div>, { autoClose: 8000, icon: false }
        );
      });

      // ── Silent Hydration Events ──
      socket.on('patient:updated', (data = {}) => setSilentUpdate(data));
      socket.on('lab:update', (data = {}) => setSilentUpdate(data));
      socket.on('radiology:updated', (data = {}) => setSilentUpdate(data));
      socket.on('cashier:update', (data = {}) => setSilentUpdate({ ...data, type: 'cashier', ts: Date.now() }));
    }

    if (isStoreRole) {
      // ── General Store: stock received / issued ──
      socket.on('inventory:updated', (data = {}) => setSilentUpdate({ ...data, type: 'inventory' }));
      socket.on('batch:received', (data = {}) => {
        setSilentUpdate({ type: 'inventory' });
        const itemsCount = data.items?.length || 0;
        let title, itemName, itemBadge;

        if (itemsCount === 1) {
            const formattedQty = formatArabicQuantity(data.items[0].quantity, data.items[0].item_unit);
            title = 'عملية استلام';
            itemName = data.items[0].item_name;
            itemBadge = formattedQty;
        } else {
            title = `استلام دفعة (${formatArabicItemsCount(itemsCount)})`;
        }

        addNotification({ 
            type: 'receive',
            storePayload: {
                title,
                itemName,
                itemBadge,
                footerText: `المورد: ${data.supplier}`
            },
            message: itemName ? `${title}, ${itemName} (${itemBadge}), المورد: ${data.supplier}` : `${title} | المورد: ${data.supplier}`
        });
      });

      socket.on('batch:issued', (data = {}) => {
        setSilentUpdate({ type: 'inventory' });
        const itemsCount = data.items?.length || 0;
        let title, itemName, itemBadge;

        if (itemsCount === 1) {
            const formattedQty = formatArabicQuantity(data.items[0].quantity, data.items[0].item_unit);
            title = 'عملية صرف';
            itemName = data.items[0].item_name;
            itemBadge = formattedQty;
        } else {
            title = `صرف دفعة (${formatArabicItemsCount(itemsCount)})`;
        }

        addNotification({ 
            type: 'issue',
            storePayload: {
                title,
                itemName,
                itemBadge,
                footerText: `الوجهة: ${data.destination}`
            },
            message: itemName ? `${title}, ${itemName} (${itemBadge}), الوجهة: ${data.destination}` : `${title} | الوجهة: ${data.destination}`
        });
      });

      // ── Transfer Notifications ──
      
      socket.on('transfer:revoked', (data = {}) => {
        setSilentUpdate({ type: 'transfer' });
        const fallbackSender = role === 'or_store' ? 'المخزن العام' : 'مخزن العمليات';
        const smartName = getSmartItemText(data.item_count, data.item_name || data.batch_ref);
        const msg = `تم إلغاء وسحب شحنة ${smartName} من قبل ${data.sender_name || fallbackSender}`;
        addNotification({
          type: 'alert',
          storePayload: {
            title: 'إلغاء شحنة',
            itemName: getSmartItemText(data.item_count, data.item_name || data.batch_ref),
            footerText: `إلغاء من قبل: ${data.sender_name || fallbackSender}`
          },
          message: msg
        });
        toast.info(
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-white" />
            <span className="font-semibold text-sm">{msg}</span>
          </div>, { position: 'bottom-right', autoClose: 6000, icon: false }
        );
      });

      socket.on('transfer:sent', (data = {}) => {
        setSilentUpdate({ type: 'transfer' });
        const fallbackSender = role === 'or_store' ? 'المخزن العام' : 'مخزن العمليات';
        const dynamicPath = role === 'or_store' ? '/or-store/receive' : '/general-store/receive';
        addNotification({
          type: 'receive',
          actionPath: dynamicPath,
          storePayload: {
            title: 'شحنة واردة جديدة',
            itemName: getSmartItemText(data.item_count, data.item_name || data.batch_ref),
            itemBadge: data.quantity_label,
            footerText: `من: ${data.sender_name || fallbackSender}`
          },
          message: data.message || `شحنة جديدة: ${getSmartItemText(data.item_count, data.item_name || data.batch_ref)} من ${fallbackSender}`
        });
      });

      socket.on('transfer:received', (data = {}) => {
        setSilentUpdate({ type: 'inventory' }); // refresh ledger
        const fallbackSender = role === 'or_store' ? 'المخزن العام' : 'مخزن العمليات';
        const smartName = getSmartItemText(data.item_count, data.item_name || data.batch_ref);
        const msg = `تم تأكيد استلام شحنة ${smartName} من قبل ${data.sender_name || fallbackSender}`;
        addNotification({
          type: 'receive',
          storePayload: {
            title: 'تأكيد استلام شحنة',
            itemName: getSmartItemText(data.item_count, data.item_name || data.batch_ref),
            footerText: `بواسطة: ${data.sender_name || fallbackSender}`
          },
          message: msg
        });
        toast.success(
          <div className="flex items-center gap-3">
            <Package size={20} className="text-white" />
            <span className="font-semibold text-sm">{msg}</span>
          </div>, { position: 'bottom-right', autoClose: 6000, icon: false }
        );
      });

      socket.on('transfer:rejected', (data = {}) => {
        setSilentUpdate({ type: 'inventory' }); // update general store ledger
        addNotification({
          type: 'alert',
          storePayload: {
            title: 'تم رفض الشحنة',
            itemName: getSmartItemText(data.item_count, data.item_name || data.batch_ref),
            bodyPost: ` - السبب: ${data.reason}`,
            footerText: `رفض بواسطة: ${data.sender_name}`
          },
          message: `تم رفض شحنة ${getSmartItemText(data.item_count, data.item_name || data.batch_ref)}. السبب: ${data.reason}`
        });
      });
    }

    return () => {
      if (!isStoreRole) {
        socket.off('patient:registered');
        socket.off('patient:waiting');
        socket.off('request:new');
        socket.off('lab:completed');
        socket.off('radiology:completed');
        socket.off('surgery:new_referral');
        socket.off('surgery:payment_received');
        socket.off('backup:done');
        socket.off('backup:failed');
        socket.off('patient:updated');
        socket.off('lab:update');
        socket.off('radiology:updated');
        socket.off('cashier:update');
      }
      if (isStoreRole) {
        socket.off('inventory:updated');
        socket.off('batch:received');
        socket.off('batch:issued');
        socket.off('transfer:sent');
        socket.off('transfer:received');
        socket.off('transfer:revoked');
        socket.off('transfer:rejected');
      }
    };
  }, [role]);
};

export default useRealtimeNotifications;
