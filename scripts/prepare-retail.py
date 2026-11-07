"""Converts the Online Retail II spreadsheet into the CSV read by evaluate-real.js.

Keeps completed sales of real products by known customers. Customer numbers are
already pseudonymous in the source. Neither file belongs in this repository:
only aggregate results are published.

Usage: python scripts/prepare-retail.py online-retail-ii.xlsx retail.csv
Requires openpyxl.
"""
import csv
import re
import sys

from openpyxl import load_workbook

PRODUCT_CODE = re.compile(r"^\d{5}[A-Za-z]*$")
COLUMNS = ["invoice", "stock", "description", "quantity", "date", "price", "customer"]


def main(source, target):
    workbook = load_workbook(source, read_only=True)
    seen = set()
    kept = 0
    with open(target, "w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(COLUMNS)
        for sheet in workbook.worksheets:
            rows = sheet.iter_rows(min_row=2, values_only=True)
            for invoice, stock, description, quantity, date, price, customer, _ in rows:
                if customer is None or quantity is None or quantity <= 0 or not price:
                    continue
                invoice, stock = str(invoice), str(stock)
                if invoice.startswith("C") or not PRODUCT_CODE.match(stock):
                    continue
                # The two sheets overlap, so a line can appear twice.
                key = (invoice, stock, str(date), quantity)
                if key in seen:
                    continue
                seen.add(key)
                writer.writerow(
                    [invoice, stock, description or "", quantity, date.isoformat(), price, int(customer)]
                )
                kept += 1
    print(f"Kept {kept} lines")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
