import React from 'react';
import { Report, Responder, Profile } from '../types';
import ControllerReportDetail from './ControllerReportDetail';
import { XIcon } from './icons';

interface ReportDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: Report | null;
    responders: Responder[];
    profile: Profile;
    allUsers: Profile[];
    onRefresh?: () => void;
    onEdit?: (report: Report) => void;
}

const ReportDetailModal: React.FC<ReportDetailModalProps> = ({ isOpen, onClose, report, responders, profile, allUsers, onRefresh, onEdit }) => {
    if (!isOpen || !report) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 print:bg-transparent print:backdrop-blur-none print:static print:block" aria-labelledby="report-detail-modal-title" role="dialog" aria-modal="true">
            <div className="relative bg-transparent w-full h-full sm:rounded-2xl sm:w-11/12 sm:max-w-xl sm:h-auto sm:max-h-[90vh] flex flex-col print:static print:w-auto print:h-auto print:max-h-none">
                <button onClick={onClose} className="absolute top-2 right-2 z-20 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors print:hidden" title="Close detail view">
                    <XIcon className="w-6 h-6" />
                </button>
                <div className="flex-grow overflow-y-auto">
                    <ControllerReportDetail
                        report={report}
                        responders={responders}
                        profile={profile}
                        allUsers={allUsers}
                        onRefresh={onRefresh}
                        onEdit={onEdit || (() => {})}
                    />
                </div>
            </div>
        </div>
    );
};

export default ReportDetailModal;