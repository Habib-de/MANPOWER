package com.manpower.controller;

import com.manpower.entity.Expense;
import com.manpower.service.ExpenseService;
import com.manpower.dto.ErrorResponse; // Import ErrorResponse DTO
import io.swagger.v3.oas.annotations.Operation; // Ensure this import is correct
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus; // Import HttpStatus
import org.springframework.http.ResponseEntity; // Import ResponseEntity
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid; // For @Valid annotation
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/expenses")
@CrossOrigin(origins = "*") // Allow frontend to connect from other ports (e.g. Expo)
public class ExpenseController {

    @Autowired
    private ExpenseService expenseService;

    @Operation(summary = "Create an expense")
    @PostMapping
    public ResponseEntity<Object> create(@Valid @RequestBody Expense expense) {
        try {
            // If ID is not provided by the client, generate a UUID
            if (expense.getId() == null || expense.getId().trim().isEmpty()) {
                expense.setId(UUID.randomUUID().toString());
            }
            Expense savedExpense = expenseService.saveExpense(expense);
            return new ResponseEntity<>(savedExpense, HttpStatus.CREATED);
        } catch (Exception e) {
            // Handle potential errors during save, e.g., validation or database issues
            return new ResponseEntity<>(new ErrorResponse("Failed to create expense: " + e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Operation(summary = "Get all expenses")
    @GetMapping
    public ResponseEntity<List<Expense>> getAll() {
        List<Expense> expenses = expenseService.getAllExpenses();
        return new ResponseEntity<>(expenses, HttpStatus.OK);
    }

    @Operation(summary = "Get expense by ID")
    @GetMapping("/{id}")
    public ResponseEntity<Expense> getById(@PathVariable String id) {
        Optional<Expense> expense = expenseService.getExpenseById(id);
        return expense.map(value -> new ResponseEntity<>(value, HttpStatus.OK))
                      .orElseGet(() -> new ResponseEntity<>(HttpStatus.NOT_FOUND));
    }

    @Operation(summary = "Update an expense")
    @PutMapping("/{id}")
    public ResponseEntity<Object> update(@PathVariable String id, @Valid @RequestBody Expense expense) {
        try {
            // Ensure the ID in the path matches the ID of the expense object
            expense.setId(id);
            Expense updatedExpense = expenseService.saveExpense(expense); // Assuming saveExpense handles updates
            return new ResponseEntity<>(updatedExpense, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(new ErrorResponse("Failed to update expense: " + e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Operation(summary = "Delete an expense")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        try {
            expenseService.deleteExpense(id);
            return new ResponseEntity<>(HttpStatus.NO_CONTENT); // 204 No Content for successful deletion
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR); // Or HttpStatus.NOT_FOUND if ID not found
        }
    }
}
