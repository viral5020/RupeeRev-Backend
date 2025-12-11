import { MergedTransaction } from './transactionMerger';

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    needsManualReview: boolean;
}

export interface ValidatedTransaction extends MergedTransaction {
    validationResult: ValidationResult;
}

export const validateTransaction = (transaction: MergedTransaction): ValidatedTransaction => {
    const errors: string[] = [];
    let isValid = true;

    // 1. Valid date (YYYY-MM-DD format)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)) {
        errors.push('Invalid date format');
        isValid = false;
    } else {
        const date = new Date(transaction.date);
        if (isNaN(date.getTime())) {
            errors.push('Invalid date value');
            isValid = false;
        }
    }

    // 2. Amount is numeric and positive
    if (typeof transaction.amount !== 'number' || isNaN(transaction.amount) || transaction.amount <= 0) {
        errors.push('Invalid amount');
        isValid = false;
    }

    // 3. Debit/Credit present
    if (!transaction.debit_credit || !['Dr', 'Cr'].includes(transaction.debit_credit)) {
        errors.push('Missing or invalid debit/credit indicator');
        isValid = false;
    }

    // 4. Narration not empty
    if (!transaction.narration || transaction.narration.trim().length === 0) {
        errors.push('Empty narration');
        isValid = false;
    }

    // 5. Confidence check
    const needsManualReview = transaction.confidence < 0.5;
    if (needsManualReview) {
        errors.push('Low confidence score');
    }

    return {
        ...transaction,
        validationResult: {
            isValid,
            errors,
            needsManualReview
        }
    };
};

export const validateTransactions = (transactions: MergedTransaction[]): ValidatedTransaction[] => {
    return transactions.map(validateTransaction);
};
